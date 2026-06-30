-- CreateTable
CREATE TABLE "Credential" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "videoId" TEXT NOT NULL,
    "devicePublicKey" TEXT NOT NULL,
    "deviceType" TEXT NOT NULL,
    "startTime" REAL NOT NULL,
    "endTime" REAL NOT NULL,
    "frameCount" INTEGER NOT NULL,
    "signature" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'VERIFIED'
);

-- CreateTable
CREATE TABLE "FrameHash" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "credentialId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "timestamp" REAL NOT NULL,
    "hash" TEXT NOT NULL,
    CONSTRAINT "FrameHash_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "Credential" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
