-- CreateTable
CREATE TABLE "experiments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL UNIQUE,
    "enabled" INTEGER NOT NULL DEFAULT 0,
    "traffic" INTEGER NOT NULL DEFAULT 100,
    "variants" TEXT NOT NULL DEFAULT '[]',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "experiments_key_idx" ON "experiments"("key");
