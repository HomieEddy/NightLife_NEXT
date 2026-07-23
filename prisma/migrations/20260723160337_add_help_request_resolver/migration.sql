-- AlterTable
ALTER TABLE "happy_hour_rules" ALTER COLUMN "days_of_week" DROP DEFAULT,
ALTER COLUMN "applies_to_category_ids" DROP DEFAULT;

-- AlterTable
ALTER TABLE "help_requests" ADD COLUMN     "resolved_by_staff_id" TEXT,
ADD COLUMN     "resolved_by_staff_name" TEXT;
