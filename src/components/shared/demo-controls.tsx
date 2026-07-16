import { isDemoMode } from "@/lib/app-mode";
import { HostApprovalControl } from "@/components/demo/host-approval-control";
import { ClosureApprovalControl, OrderProgressControl } from "@/components/demo/order-fast-forwards";

export function DemoHostApprovalControl(props: React.ComponentProps<typeof HostApprovalControl>) {
  return isDemoMode() ? <HostApprovalControl {...props} /> : null;
}

export function DemoOrderProgressControl(props: React.ComponentProps<typeof OrderProgressControl>) {
  return isDemoMode() ? <OrderProgressControl {...props} /> : null;
}

export function DemoClosureApprovalControl(props: React.ComponentProps<typeof ClosureApprovalControl>) {
  return isDemoMode() ? <ClosureApprovalControl {...props} /> : null;
}
