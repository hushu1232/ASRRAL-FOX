-- CreateTable
CREATE TABLE "seller_payment_methods" (
    "id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "account" TEXT NOT NULL,
    "account_name" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "seller_payment_methods_seller_id_idx" ON "seller_payment_methods"("seller_id");

-- AddForeignKey
ALTER TABLE "seller_payment_methods" ADD CONSTRAINT "seller_payment_methods_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
