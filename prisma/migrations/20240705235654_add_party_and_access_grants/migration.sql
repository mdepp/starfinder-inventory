/*
  Warnings:

  - Added the required column `partyId` to the `InventoryItem` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "Party" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT
);

-- CreateTable
CREATE TABLE "PartyAccessGrant" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "partyId" INTEGER NOT NULL,
    "grantKey" TEXT NOT NULL,
    CONSTRAINT "PartyAccessGrant_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_InventoryItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "partyId" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "bulk" REAL NOT NULL,
    "bearerId" INTEGER,
    "category" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    CONSTRAINT "InventoryItem_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventoryItem_bearerId_fkey" FOREIGN KEY ("bearerId") REFERENCES "InventoryItemBearer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_InventoryItem" ("bearerId", "bulk", "category", "count", "description", "id") SELECT "bearerId", "bulk", "category", "count", "description", "id" FROM "InventoryItem";
DROP TABLE "InventoryItem";
ALTER TABLE "new_InventoryItem" RENAME TO "InventoryItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
