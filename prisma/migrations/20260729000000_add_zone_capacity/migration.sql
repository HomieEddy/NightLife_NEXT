-- VM-02: fire-code capacity per zone (nullable — null means uncapped)
ALTER TABLE "zones" ADD COLUMN "capacity" INTEGER;
