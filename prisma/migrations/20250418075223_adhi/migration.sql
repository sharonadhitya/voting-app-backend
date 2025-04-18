/*
  Warnings:

  - A unique constraint covering the columns `[userId,pollId]` on the table `Vote` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Vote" ADD COLUMN     "userId" TEXT,
ALTER COLUMN "sessionId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Vote_userId_pollId_key" ON "Vote"("userId", "pollId");

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
