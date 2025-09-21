/*
  Warnings:

  - You are about to drop the column `songId` on the `Song` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Song_url_key";

-- AlterTable
ALTER TABLE "Song" DROP COLUMN "songId",
ADD COLUMN     "downloadedSongId" TEXT,
ADD COLUMN     "songPath" TEXT;

-- CreateTable
CREATE TABLE "DownloadedSong" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "path" TEXT,
    "isReady" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DownloadedSong_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DownloadedSong_url_key" ON "DownloadedSong"("url");

-- AddForeignKey
ALTER TABLE "Song" ADD CONSTRAINT "Song_downloadedSongId_fkey" FOREIGN KEY ("downloadedSongId") REFERENCES "DownloadedSong"("id") ON DELETE SET NULL ON UPDATE CASCADE;
