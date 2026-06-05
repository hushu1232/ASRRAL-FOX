# =============================================================================
# avatar-web Infrastructure as Code (AWS)
# Resources: RDS PostgreSQL, ElastiCache Redis, S3, IAM roles, Secrets Manager
# =============================================================================

# --- KMS key for envelope encryption ---
resource "aws_kms_key" "main" {
  description             = "avatar-web encryption key"
  deletion_window_in_days = 30
  enable_key_rotation     = true
}

resource "aws_kms_alias" "main" {
  name          = "alias/avatar-web-${var.environment}"
  target_key_id = aws_kms_key.main.id
}

# --- RDS PostgreSQL (Multi-AZ option) ---
resource "aws_db_subnet_group" "main" {
  name       = "avatar-web-${var.environment}"
  subnet_ids = data.aws_subnets.database.ids
}

resource "aws_db_instance" "postgresql" {
  identifier = "avatar-web-${var.environment}"

  engine         = "postgres"
  engine_version = "16.3"
  instance_class = var.db_instance_class

  db_name  = var.db_name
  username = var.db_username
  password = random_password.db_master.result
  port     = 5432

  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = 200
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id            = aws_kms_key.main.arn

  multi_az               = var.db_multi_az
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  backup_retention_period = 30
  backup_window           = "03:00-04:00"
  maintenance_window      = "sun:04:00-sun:05:00"

  deletion_protection       = var.environment == "production"
  skip_final_snapshot       = false
  final_snapshot_identifier = "avatar-web-${var.environment}-final-${formatdate("YYYYMMDDhhmmss", timestamp())}"

  enabled_cloudwatch_logs_exports = ["postgresql"]
  performance_insights_enabled    = true
}

# --- Random password for DB master ---
resource "random_password" "db_master" {
  length  = 32
  special = true
}

# --- Store DB credentials in Secrets Manager ---
resource "aws_secretsmanager_secret" "db" {
  name                    = "avatar-web/${var.environment}/database"
  kms_key_id              = aws_kms_key.main.arn
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "db" {
  secret_id = aws_secretsmanager_secret.db.id
  secret_string = jsonencode({
    host     = aws_db_instance.postgresql.address
    port     = aws_db_instance.postgresql.port
    database = aws_db_instance.postgresql.db_name
    username = aws_db_instance.postgresql.username
    password = random_password.db_master.result
  })
}

# --- ElastiCache Redis (for rate limiting / caching) ---
resource "aws_elasticache_subnet_group" "main" {
  name       = "avatar-web-${var.environment}"
  subnet_ids = data.aws_subnets.cache.ids
}

resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "avatar-web-${var.environment}"
  engine               = "redis"
  node_type            = var.redis_node_type
  num_cache_nodes      = var.redis_num_cache_nodes
  parameter_group_name = "default.redis7"
  port                 = 6379
  subnet_group_name    = aws_elasticache_subnet_group.main.name
  security_group_ids   = [aws_security_group.redis.id]

  snapshot_retention_limit = 7
  snapshot_window          = "04:00-05:00"
}

# --- S3 buckets ---
resource "aws_s3_bucket" "backups" {
  bucket = "${var.s3_backup_bucket}-${var.environment}"
}

resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.main.arn
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id
  rule {
    id     = "expire-old-backups"
    status = "Enabled"
    expiration { days = 30 }
  }
}

resource "aws_s3_bucket" "assets" {
  bucket = "${var.s3_assets_bucket}-${var.environment}"
}

resource "aws_s3_bucket_versioning" "assets" {
  bucket = aws_s3_bucket.assets.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Block public access on all buckets
resource "aws_s3_bucket_public_access_block" "backups" {
  bucket                  = aws_s3_bucket.backups.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "assets" {
  bucket                  = aws_s3_bucket.assets.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# --- IAM role for K8s service account (IRSA) ---
data "aws_iam_policy_document" "irsa_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [var.eks_oidc_provider_arn]
    }
    condition {
      test     = "StringEquals"
      variable = "${replace(var.eks_oidc_provider_arn, "/^(arn:aws:iam::[0-9]+:oidc-provider/)|\/$/", "")}:sub"
      values   = ["system:serviceaccount:production:avatar-web"]
    }
  }
}

resource "aws_iam_role" "avatar_web" {
  name               = "avatar-web-${var.environment}"
  assume_role_policy = data.aws_iam_policy_document.irsa_assume.json
}

resource "aws_iam_role_policy_attachment" "s3_assets" {
  role       = aws_iam_role.avatar_web.name
  policy_arn = aws_iam_policy.s3_assets.arn
}

resource "aws_iam_policy" "s3_assets" {
  name = "avatar-web-s3-assets-${var.environment}"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.assets.arn,
          "${aws_s3_bucket.assets.arn}/*"
        ]
      }
    ]
  })
}

# --- Security groups ---
resource "aws_security_group" "rds" {
  name        = "avatar-web-rds-${var.environment}"
  description = "Allow PostgreSQL from EKS"
  vpc_id      = data.aws_vpc.main.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [data.aws_security_group.eks_nodes.id]
  }
}

resource "aws_security_group" "redis" {
  name        = "avatar-web-redis-${var.environment}"
  description = "Allow Redis from EKS"
  vpc_id      = data.aws_vpc.main.id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [data.aws_security_group.eks_nodes.id]
  }
}

# --- Data sources (pre-existing resources) ---
variable "eks_oidc_provider_arn" {
  description = "EKS OIDC provider ARN for IRSA"
  type        = string
}

data "aws_vpc" "main" {
  filter {
    name   = "tag:Name"
    values = ["${var.environment}-vpc"]
  }
}

data "aws_subnets" "database" {
  filter {
    name   = "tag:Tier"
    values = ["database"]
  }
}

data "aws_subnets" "cache" {
  filter {
    name   = "tag:Tier"
    values = ["cache"]
  }
}

data "aws_security_group" "eks_nodes" {
  filter {
    name   = "tag:aws:eks:cluster-name"
    values = ["${var.environment}-cluster"]
  }
}
