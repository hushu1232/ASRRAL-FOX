/*
  Warnings:

  - The `files` column on the `market_items` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `preview_images` column on the `market_items` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "market_items" DROP COLUMN "files",
ADD COLUMN     "files" JSONB NOT NULL DEFAULT '[]',
DROP COLUMN "preview_images",
ADD COLUMN     "preview_images" JSONB NOT NULL DEFAULT '[]';
