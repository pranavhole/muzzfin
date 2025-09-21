-- DropForeignKey
ALTER TABLE "Song" DROP CONSTRAINT "Song_streamId_fkey";

-- DropIndex
DROP INDEX "Song_streamId_key";

-- AddForeignKey
ALTER TABLE "Stream" ADD CONSTRAINT "Stream_currentSongId_fkey" FOREIGN KEY ("currentSongId") REFERENCES "Song"("id") ON DELETE SET NULL ON UPDATE CASCADE;
