import { TransactionRecord } from "@/components/jobs/transaction-record";
import { exampleRecord } from "@/lib/examples";

export function HeroRecord() {
  return <div className="hero-record" aria-label="Example transaction record">
    <TransactionRecord record={exampleRecord} compact example/>
  </div>;
}
