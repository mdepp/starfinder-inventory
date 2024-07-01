-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "description" TEXT NOT NULL,
    "bulk" REAL NOT NULL,
    "bearerId" INTEGER NOT NULL,
    CONSTRAINT "InventoryItem_bearerId_fkey" FOREIGN KEY ("bearerId") REFERENCES "InventoryItemBearer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventoryItemBearer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL
);
