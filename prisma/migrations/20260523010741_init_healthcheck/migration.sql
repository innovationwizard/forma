-- CreateTable
CREATE TABLE "_health_check" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "pingedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "_health_check_pkey" PRIMARY KEY ("id")
);
