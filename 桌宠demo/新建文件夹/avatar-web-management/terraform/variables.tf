variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "production"
}

# --- RDS PostgreSQL ---
variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t4g.medium"
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "avatar_management"
}

variable "db_username" {
  description = "Master username"
  type        = string
  default     = "avatar_admin"
}

variable "db_allocated_storage" {
  description = "Allocated storage (GB)"
  type        = number
  default     = 50
}

variable "db_multi_az" {
  description = "Enable Multi-AZ for production"
  type        = bool
  default     = false
}

# --- ElastiCache Redis ---
variable "redis_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t4g.micro"
}

variable "redis_num_cache_nodes" {
  description = "Number of Redis nodes (1 = standalone, 2+ = cluster)"
  type        = number
  default     = 1
}

# --- S3 ---
variable "s3_backup_bucket" {
  description = "S3 bucket for database backups"
  type        = string
  default     = "avatar-web-backups"
}

variable "s3_assets_bucket" {
  description = "S3 bucket for user-uploaded assets"
  type        = string
  default     = "avatar-web-assets"
}
