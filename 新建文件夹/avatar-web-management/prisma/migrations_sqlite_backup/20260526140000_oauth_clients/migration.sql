-- CreateTable
CREATE TABLE "oauth_clients" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "client_id" TEXT NOT NULL UNIQUE,
    "client_secret" TEXT NOT NULL,
    "redirect_uris" TEXT NOT NULL DEFAULT '[]',
    "scopes" TEXT NOT NULL DEFAULT '["openid","profile","email"]',
    "grant_types" TEXT NOT NULL DEFAULT '["authorization_code","refresh_token"]',
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "oauth_clients_client_id_key" ON "oauth_clients"("client_id");
