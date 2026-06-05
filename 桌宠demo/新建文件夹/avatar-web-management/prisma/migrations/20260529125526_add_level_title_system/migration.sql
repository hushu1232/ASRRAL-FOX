-- AlterTable
ALTER TABLE "users" ADD COLUMN     "active_title" TEXT,
ADD COLUMN     "clone_reset_date" TIMESTAMP(3),
ADD COLUMN     "exp" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "last_login_date" TIMESTAMP(3),
ADD COLUMN     "level" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "monthly_clone_used" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "total_login_days" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "unlocked_titles" TEXT[] DEFAULT ARRAY[]::TEXT[];
