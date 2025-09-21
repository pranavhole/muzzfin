/*
  Warnings:

  - A unique constraint covering the columns `[url]` on the table `Song` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Song" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "hasSong" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "songId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Song_url_key" ON "Song"("url");
