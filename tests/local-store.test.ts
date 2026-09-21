import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { LocalStoreRepository } from "../lib/db/local-store";
import { createAggregate } from "../lib/domain/jobs";
import { acceptAggregate } from "./support/lifecycle";
test("local repository rejects stale writes and event edits; corruption is not replaced by sample data",async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),"trustlink-test-"));const file=path.join(dir,"store.json");
 try {
  const repo=new LocalStoreRepository(file);
  const {aggregate,token}=createAggregate({providerId:"provider",title:"Work",category:"Design",scope:"Logo",deliverables:["Logo"],price:"100",deadline:"2099-01-01",revisions:1,cancellationTerms:"Agreed",sourceChannel:"Direct",repeatUse:"FIRST"});
  await repo.commit(aggregate,null);
  const accepted=acceptAggregate(aggregate,token,{name:"Client",email:"client@example.com"});
  await repo.commit(accepted,0);await assert.rejects(repo.commit(accepted,0),/changed/);
  const changed=structuredClone(accepted);changed.job.version++;changed.events[0].metadata.fake=true;changed.events.push({...changed.events[0],id:"another"});
  await assert.rejects(repo.commit(changed,1),/immutable/);
  await writeFile(file,"broken JSON");await assert.rejects(repo.getAggregate(aggregate.job.id));assert.equal(await readFile(file,"utf8"),"broken JSON");
 }finally{await rm(dir,{recursive:true,force:true});}
});
