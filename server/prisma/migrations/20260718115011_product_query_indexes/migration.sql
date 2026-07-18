-- CreateIndex
CREATE INDEX "products_category_id_price_idx" ON "products"("category_id", "price");

-- CreateIndex
CREATE INDEX "products_created_at_id_idx" ON "products"("created_at", "id");

-- CreateIndex
CREATE INDEX "products_price_id_idx" ON "products"("price", "id");

-- CreateIndex
CREATE INDEX "products_likes_count_id_idx" ON "products"("likes_count", "id");
