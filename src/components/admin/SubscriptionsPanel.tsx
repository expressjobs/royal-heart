import { BarChart3, CreditCard, Receipt, Tag, Users, Wallet } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SubAnalytics } from "@/components/admin/subscriptions/SubAnalytics";
import { PlanManager } from "@/components/admin/subscriptions/PlanManager";
import { CouponManager } from "@/components/admin/subscriptions/CouponManager";
import { ProviderSettings } from "@/components/admin/subscriptions/ProviderSettings";
import { SubscriberList } from "@/components/admin/subscriptions/SubscriberList";
import { TransactionsLedger } from "@/components/admin/subscriptions/TransactionsLedger";

const TABS = [
  { value: "analytics", label: "Analytics", icon: BarChart3 },
  { value: "plans", label: "Plans", icon: Wallet },
  { value: "subscribers", label: "Subscribers", icon: Users },
  { value: "transactions", label: "Transactions", icon: Receipt },
  { value: "coupons", label: "Promo codes", icon: Tag },
  { value: "providers", label: "Providers", icon: CreditCard },
] as const;

export function SubscriptionsPanel() {
  return (
    <Tabs defaultValue="analytics" className="w-full">
      <TabsList className="mb-6 flex h-auto w-full flex-wrap justify-start gap-1 bg-muted/60 p-1">
        {TABS.map((t) => (
          <TabsTrigger
            key={t.value}
            value={t.value}
            className="gap-1.5 rounded-lg data-[state=active]:bg-card"
          >
            <t.icon className="h-4 w-4" />
            <span>{t.label}</span>
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="analytics">
        <SubAnalytics />
      </TabsContent>
      <TabsContent value="plans">
        <PlanManager />
      </TabsContent>
      <TabsContent value="subscribers">
        <SubscriberList />
      </TabsContent>
      <TabsContent value="transactions">
        <TransactionsLedger />
      </TabsContent>
      <TabsContent value="coupons">
        <CouponManager />
      </TabsContent>
      <TabsContent value="providers">
        <ProviderSettings />
      </TabsContent>
    </Tabs>
  );
}
