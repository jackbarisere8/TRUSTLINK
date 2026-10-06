import { test, expect, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
async function login(page:Page,email:string,expected:RegExp=/\/dashboard$/) {
  await page.goto("/login");await page.getByLabel("Email address").fill(email);await page.getByLabel(/password/i).fill("fixture-password-only");await page.getByRole("button",{name:/log in/i}).click();await expect(page).toHaveURL(expected);
}
async function confirm(page:Page) { const button=page.getByRole("button",{name:"Confirm change",exact:true}); await button.click(); await expect(button).toHaveCount(0); }
async function mockGeolocation(page:Page,latitude=6.6018,longitude=3.3515){
  await page.addInitScript(({latitude,longitude})=>Object.defineProperty(navigator,"geolocation",{configurable:true,value:{
    getCurrentPosition(success:PositionCallback){success({coords:{latitude,longitude,accuracy:10,altitude:null,altitudeAccuracy:null,heading:null,speed:null,toJSON(){return {latitude,longitude,accuracy:10};}},timestamp:Date.now(),toJSON(){return {latitude,longitude};}});},
  }}),{latitude,longitude});
}
async function checkWidths(page:Page) {
  for(const width of [375,390,414,430,768,1024,1280,1440,1920]){
    await page.setViewportSize({width,height:900});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),page.url()+" at "+width).toBe(false);
  }
  await page.setViewportSize({width:1280,height:900});
}
async function expectReachable(page: Page, routes: string[]) {
  for (const route of routes) {
    const response = await page.goto(route);
    expect(response?.status(), route).toBe(200);
    await expect(page.locator("main h1").first(), route).toBeVisible();
    await expect(page.getByRole("heading", { name: "Page not found.", exact: true }), route).toHaveCount(0);
  }
}
test("provider/client/admin workflow through Supabase adapter and real PostgreSQL",async({browser,page:provider})=>{
  test.setTimeout(240000);
  const errors:string[]=[];provider.on("pageerror",e=>errors.push(e.message));
  await login(provider,"provider@example.test");
  const brandSource = await provider.locator("header img").first().getAttribute("src");
  expect(brandSource).toMatch(/^\/_next\/static\/media\//);
  const brandResponse = await provider.request.get(brandSource!);
  expect(brandResponse.ok()).toBe(true);
  const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
  expect(digest(await brandResponse.body())).toBe(digest(await readFile("app/icon.png")));
  const faviconSources = await provider.locator("head link[rel='icon']").evaluateAll(links =>
    links.map(link => link.getAttribute("href")).filter((href): href is string => Boolean(href)),
  );
  expect(faviconSources.length).toBeGreaterThan(0);
  for (const faviconSource of faviconSources) {
    const faviconResponse = await provider.request.get(faviconSource);
    expect(faviconResponse.ok()).toBe(true);
    expect(digest(await faviconResponse.body())).toBe(digest(await readFile("app/icon.png")));
  }
  await expect(provider.getByText("No transactions here yet")).toBeVisible();
  await expect(provider.getByText("Your first TrustLink transaction will appear here once you create one.",{exact:true})).toBeVisible();
  await expect(provider.getByRole("heading",{name:"Recent activity"})).toHaveCount(0);
  await checkWidths(provider);
  await provider.screenshot({path:"test-results/workspace-empty-1280.png",fullPage:true});
  await provider.goto("/p/provider-11111111111141118111111111111111");
  await expect(provider.getByRole("heading",{name:"How they work",exact:true})).toBeVisible();
  await expect(provider.getByRole("heading",{name:"What they do",exact:true})).toBeVisible();
  await expect(provider.getByText("No service description has been added.",{exact:true})).toBeVisible();
  await expect(provider.getByText("Service area: Not provided",{exact:true})).toHaveCount(0);
  await expect(provider.getByText("No completed transactions recorded yet.",{exact:false})).toBeVisible();
  await expect(provider.getByRole("heading",{name:"Selected work",exact:true})).toHaveCount(0);
  await checkWidths(provider);
  await provider.screenshot({path:"test-results/profile-new-1280.png",fullPage:true});
  await provider.setViewportSize({width:390,height:900});
  await provider.screenshot({path:"test-results/profile-new-390.png",fullPage:true});
  await provider.setViewportSize({width:1280,height:900});
  await provider.goto("/dashboard/jobs/new");
  await checkWidths(provider);
  for(const [label,value]of [["Service title","Audit workflow website"],["Service category","Web design"],["Agreed scope","A homepage and a contact page"],["Deliverables, one per line","Homepage\nContact page"],["Fee (NGN)","180000"],["Deadline","2099-10-18"],["Included revision rounds","1"],["Cancellation terms","Discuss cancellation before acceptance"]])await provider.getByLabel(label).fill(value);
  await provider.getByRole("button",{name:"Preview agreement"}).click();
  await expect(provider.getByText("Public ID assigned after publication",{exact:true})).toBeVisible();
  await provider.getByRole("checkbox").check();await provider.getByRole("button",{name:"Publish & create client link"}).click();
  const invite=await provider.getByLabel("Private client link").inputValue();
  const publicHref=await provider.getByRole("link",{name:"View public agreement",exact:true}).getAttribute("href");
  expect(publicHref).toMatch(/^\/j\/[a-f0-9]{24}$/);expect(new URL(invite).pathname).toBe(publicHref);
  await provider.getByRole("link",{name:"Open workspace",exact:true}).click();
  await expect(provider).toHaveURL(/\/dashboard\/jobs\/[a-f0-9-]{36}$/);
  const workspace=provider.url(),jobId=workspace.split("/").at(-1)!;
  await checkWidths(provider);
  await provider.screenshot({path:"test-results/transaction-workspace-1280.png",fullPage:true});
  await provider.goto("/dashboard");
  await expect(provider.getByRole("region",{name:"Active transactions"}).getByRole("heading",{name:"Audit workflow website"})).toBeVisible();
  await expect(provider.getByRole("region",{name:"Current actions"}).getByText("No action is needed from you right now.")).toBeVisible();
  await expect(provider.getByRole("region",{name:"Recent activity"}).getByText("Ready to share",{exact:true})).toBeVisible();
  await expect(provider.getByRole("region",{name:"Pending work"}).getByText("Awaiting client acceptance",{exact:true})).toBeVisible();
  await checkWidths(provider);
  await provider.screenshot({path:"test-results/workspace-active-1280.png",fullPage:true});
  await provider.setViewportSize({width:390,height:900});
  await provider.screenshot({path:"test-results/workspace-active-390.png",fullPage:true});
  await provider.setViewportSize({width:1280,height:900});
  await provider.goto(workspace);
  const publicPath=new URL(invite).pathname,publicId=publicPath.split("/").at(-1)!;
  const publicContext=await browser.newContext({baseURL:"http://127.0.0.1:3001"});const publicRecord=await publicContext.newPage();publicRecord.on("pageerror",e=>errors.push(e.message));
  await publicRecord.goto(publicPath);
  await expect(publicRecord.getByRole("heading",{name:"Audit workflow website",exact:true})).toBeVisible();
  await expect(publicRecord.getByText("A homepage and a contact page",{exact:true})).toBeVisible();
  await expect(publicRecord.locator("li").filter({hasText:"Homepage"}).first()).toBeVisible();
  await expect(publicRecord.locator("li").filter({hasText:"Contact page"}).first()).toBeVisible();
  await expect(publicRecord.getByText(/180,000/)).toBeVisible();
  await expect(publicRecord.getByText("18 Oct 2099",{exact:true})).toBeVisible();
  await expect(publicRecord.getByText("1 included round",{exact:false})).toBeVisible();
  await expect(publicRecord.getByRole("link",{name:"Ada Provider",exact:true})).toBeVisible();
  await expect(publicRecord.getByText("Awaiting acceptance",{exact:true})).toBeVisible();
  await expect(publicRecord.getByRole("heading",{name:"Participants",exact:true})).toBeVisible();
  await expect(publicRecord.getByText("Client acceptance not recorded",{exact:true})).toBeVisible();
  await expect(publicRecord.getByRole("heading",{name:"Transaction history",exact:true})).toBeVisible();
  await expect(publicRecord.getByText("Record created",{exact:true})).toBeVisible();
  await expect(publicRecord.getByText("Ready to share",{exact:true})).toBeVisible();
  await expect(publicRecord.getByRole("heading",{name:"Next step",exact:true})).toBeVisible();
  const agreementText=await publicRecord.locator(".public-agreement").innerText();
  let previousPosition=-1;
  for(const label of ["Provider","Audit workflow website","Current status","Agreed terms","Agreed fee","Deadline","Deliverables","Revision terms","Participants","Transaction history","Next step"]){
    const position=agreementText.indexOf(label,previousPosition+1);
    expect(position,`${label} should follow the preceding agreement detail`).toBeGreaterThan(previousPosition);
    previousPosition=position;
  }
  await checkWidths(publicRecord);
  await publicRecord.screenshot({path:"test-results/public-transaction-1280.png",fullPage:true});
  await publicRecord.setViewportSize({width:390,height:900});
  await publicRecord.screenshot({path:"test-results/public-transaction-390.png",fullPage:true});
  await publicRecord.setViewportSize({width:1280,height:900});
  await expect(publicRecord).toHaveTitle(/Audit workflow website.*Ada Provider.*TrustLink/);
  const publicMetadata=await publicRecord.evaluate(()=>({
    description:document.querySelector('meta[name="description"]')?.getAttribute("content")||"",
    openGraphTitle:document.querySelector('meta[property="og:title"]')?.getAttribute("content")||"",
  }));
  expect(publicMetadata.description).toContain("Audit workflow website");expect(publicMetadata.description).toContain("Ada Provider");expect(publicMetadata.openGraphTitle).toContain("Audit workflow website");expect(publicMetadata.openGraphTitle).toContain("Ada Provider");
  const publicHtml=await publicRecord.content();expect(publicHtml).not.toContain("clientActionTokenHash");expect(publicHtml).not.toContain("private-client@example.test");expect(publicHtml).not.toContain("Private Client Name");
  await publicContext.close();
  const clientContext=await browser.newContext({baseURL:"http://127.0.0.1:3001"});const client=await clientContext.newPage();client.on("pageerror",e=>errors.push(e.message));
  await client.goto(invite);await expect.poll(()=>new URL(client.url()).hash).toBe("");
  const acceptButton=client.getByRole("button",{name:"Review & accept terms"});await expect(acceptButton).toBeVisible();
  expect(await client.content()).not.toContain(new URL(invite).hash.slice(1));await acceptButton.click();
  await client.getByLabel("Your name or organization").fill("Private Client Name");await client.getByLabel("Your email").fill("private-client@example.test");await client.getByRole("checkbox").check();await client.getByRole("button",{name:"Confirm acceptance"}).click();
  await expect(client.getByText("Accepted",{exact:true})).toBeVisible();
  await expect(client.getByText("Guest participant",{exact:true})).toBeVisible();await expect(client.getByText("Self-provided contact details",{exact:true})).toBeVisible();
  const outsiderContext=await browser.newContext({baseURL:"http://127.0.0.1:3001"});const outsider=await outsiderContext.newPage();
  const wrongOriginClaim=await outsider.request.post("/api/client-capability/"+publicId,{data:{token:new URL(invite).hash.slice("#invite=".length)},headers:{Origin:"https://wrong-origin.test"}});expect(wrongOriginClaim.status()).toBe(403);
  await outsider.goto(publicPath);await expect(outsider.getByRole("button",{name:/accept|approve|record payment/i})).toHaveCount(0);
  expect(await outsider.content()).not.toContain("private-client@example.test");expect(await outsider.content()).not.toContain("clientActionTokenHash");await expect(outsider.getByText("Agreement accepted by client",{exact:true})).toBeVisible();await expect(outsider.locator("#transaction-participants-heading")).toHaveCount(0);
  await provider.goto("/dashboard");await expect(provider.getByRole("region",{name:"Current actions"}).getByText("Record payment after receipt",{exact:true})).toBeVisible();await expect(provider.getByRole("region",{name:"Recent activity"}).getByText("Agreement accepted",{exact:true})).toBeVisible();await provider.goto(workspace);
  await login(outsider,"other@example.test");await outsider.goto(workspace);await expect(outsider.getByRole("heading",{name:"Page not found.",exact:true})).toBeVisible();
  await provider.goto("/dashboard/jobs");await expect(provider.getByText("Private Client Name",{exact:false})).toBeVisible();await provider.goto(workspace);
  await provider.getByRole("button",{name:"Record payment received",exact:true}).click();
  await expect(provider.getByRole("region",{name:"Transaction actions"}).getByText("₦180,000",{exact:true})).toBeVisible();
  await provider.getByRole("button",{name:"Confirm payment received",exact:true}).click();
  const paymentSection=provider.getByRole("heading",{name:"Recorded payment",exact:true}).locator("..");await expect(paymentSection).toBeVisible();
  await expect(paymentSection.getByText("Payment verification",{exact:true})).toBeVisible();await expect(paymentSection.getByText("Not available",{exact:true})).toBeVisible();
  await expect(paymentSection.getByText("₦180,000",{exact:true})).toBeVisible();
  await provider.getByRole("button",{name:"Start work",exact:true}).click();await provider.getByRole("button",{name:"Submit delivery",exact:true}).click();
  await provider.getByLabel("Describe your delivery").fill("First website delivery");
  const pendingUpload=provider.waitForResponse(r=>r.url().includes("/api/evidence/")&&r.request().method()==="POST");
  await provider.getByLabel("Private attachments (optional)").setInputFiles({name:"unsafe.exe",mimeType:"text/plain",buffer:Buffer.from("Pending plain-text evidence")});
  expect((await pendingUpload).status()).toBe(200);await expect(provider.getByText("unsafe.txt",{exact:true})).toBeVisible();
  const pendingDelete=provider.waitForResponse(r=>r.url().includes("/api/evidence/")&&r.request().method()==="DELETE");
  await provider.getByRole("button",{name:"Remove",exact:true}).click();expect([200,202]).toContain((await pendingDelete).status());await expect(provider.getByText("unsafe.txt",{exact:true})).toHaveCount(0);
  const upload=provider.waitForResponse(r=>r.url().includes("/api/evidence/")&&r.request().method()==="POST");
  await provider.getByLabel("Private attachments (optional)").setInputFiles({name:"evidence.pdf",mimeType:"application/pdf",buffer:Buffer.from("%PDF-1.7\nTest evidence\n%%EOF")});
  const uploaded=await upload;expect(uploaded.status()).toBe(200);const file=await uploaded.json();
  await expect(provider.getByText("evidence.pdf",{exact:true})).toBeVisible();await confirm(provider);
  expect((await provider.request.delete("/api/evidence/"+jobId+"?path="+encodeURIComponent(file.path),{headers:{Origin:"http://127.0.0.1:3001"}})).status()).toBe(403);
  await client.reload();await expect(client.getByText("First website delivery")).toBeVisible();
  const downloadPath="/api/evidence/"+jobId+"?path="+encodeURIComponent(file.path);
  const signedResponse=client.waitForResponse(r=>new URL(r.url()).pathname==="/api/evidence/"+jobId);
  const download=client.waitForEvent("download");
  await client.getByRole("link",{name:"Download private attachment 1",exact:true}).click();
  expect((await signedResponse).status()).toBe(303);
  expect((await download).suggestedFilename()).toBe("evidence.pdf");
  const outsiderCookies=(await outsiderContext.cookies()).map(c=>c.name+"="+c.value).join("; ");
  expect((await outsider.request.get(downloadPath,{maxRedirects:0,headers:{Cookie:outsiderCookies}})).status()).toBe(403);
  expect((await client.request.post("/api/evidence/"+jobId,{headers:{Origin:"https://wrong-origin.test"}})).status()).toBe(403);
  await client.getByRole("button",{name:"Request revision",exact:true}).click();await client.getByLabel("What needs revision?").fill("Update the heading");await confirm(client);
  await provider.reload();await provider.getByRole("button",{name:"Start revision",exact:true}).click();await provider.getByRole("button",{name:"Submit delivery",exact:true}).click();await provider.getByLabel("Describe your delivery").fill("Revised website delivery");await confirm(provider);
  await client.reload();await expect(client.getByRole("button",{name:"Request revision",exact:true})).toHaveCount(0);await expect(client.getByText("The included revision limit has been reached.",{exact:false})).toBeVisible();await client.getByRole("button",{name:"Open transaction dispute",exact:true}).click();await client.getByLabel("Details",{exact:true}).fill("Contact page is missing");await confirm(client);await expect(client.getByText("Disputed",{exact:true})).toBeVisible();
  await provider.reload();await provider.getByRole("button",{name:"Respond to dispute",exact:true}).click();await provider.getByLabel("Your response",{exact:true}).fill("I will add the missing contact page");await confirm(provider);await expect(provider.getByText("I will add the missing contact page",{exact:true})).toBeVisible();await expect(provider.getByText("under review",{exact:true})).toBeVisible();await expect(provider.getByRole("button",{name:"Respond to dispute",exact:true})).toHaveCount(0);
  const adminContext=await browser.newContext({baseURL:"http://127.0.0.1:3001"});const admin=await adminContext.newPage();await login(admin,"admin@example.test",/\/admin$/);await admin.goto("/disputes/"+jobId);await expect(admin.getByRole("heading",{name:"Review the agreement and evidence.",exact:true})).toBeVisible();await expect(admin.getByRole("link",{name:"Review dispute evidence",exact:false})).toHaveAttribute("href","#dispute-evidence");await expect(admin.locator("#dispute-evidence")).toContainText("Contact page is missing");await admin.screenshot({path:"test-results/dispute-record-1280.png",fullPage:true});await admin.getByRole("button",{name:"Resolve dispute",exact:true}).click();await admin.getByLabel("Resolution notes",{exact:true}).fill("Provider will submit the missing contact page");await expect(admin.getByText("does not hold funds",{exact:false})).toBeVisible();await confirm(admin);
  await provider.reload();await provider.getByRole("button",{name:"Submit delivery",exact:true}).click();await provider.getByLabel("Describe your delivery").fill("Complete website including contact page");await confirm(provider);
  await client.reload();await client.getByRole("button",{name:"Approve delivery",exact:true}).click();await confirm(client);await expect(client.getByText("Approved",{exact:true})).toBeVisible();
  await provider.reload();await provider.getByRole("button",{name:"Complete transaction",exact:true}).click();await expect(provider.getByText("Completed",{exact:true})).toBeVisible();
  await client.reload();await client.getByRole("button",{name:"Leave a review",exact:true}).click();await client.getByLabel("Client rating").selectOption("4");await client.getByLabel("Details",{exact:true}).fill("The record helped us resolve the missing page");await confirm(client);await expect(client.getByText("4 / 5",{exact:true})).toBeVisible();
  await provider.goto("/p/provider-11111111111141118111111111111111");
  for(const heading of ["How they work","What they do","Completed transactions","Delivery consistency","Client feedback","Selected work","Transaction history"])await expect(provider.getByRole("heading",{name:heading,exact:true})).toBeVisible();
  await expect(provider.getByText("Services in completed records",{exact:true})).toBeVisible();
  await expect(provider.getByText("100% on-time across 1 completed record",{exact:false})).toBeVisible();
  await expect(provider.getByText("Client rating: 4 / 5",{exact:true})).toBeVisible();
  await expect(provider.getByText("TrustLink / Completed transaction record",{exact:true})).toBeVisible();
  await expect(provider.getByRole("link",{name:"Audit workflow website",exact:true}).first()).toBeVisible();
  await expect(provider.getByText("The record helped us resolve the missing page",{exact:false})).toBeVisible();
  await expect(provider.getByText(/₦/)).toHaveCount(0);
  await checkWidths(provider);
  await provider.screenshot({path:"test-results/profile-completed-1280.png",fullPage:true});
  await provider.setViewportSize({width:390,height:900});
  await provider.screenshot({path:"test-results/profile-completed-390.png",fullPage:true});
  await provider.setViewportSize({width:1280,height:900});
  await provider.goto(workspace);await provider.getByRole("button",{name:"Replace client link",exact:true}).click();await confirm(provider);const replacement=await provider.getByLabel("Private client link").inputValue();
  await client.reload();await expect(client.getByText("You are viewing the public agreement.",{exact:false})).toBeVisible();await client.goto(replacement);await expect(client.getByText("Client review",{exact:true})).toBeVisible();
  const cookie=(await clientContext.cookies()).find(c=>c.name==="tl_client_"+publicId)!;const evidenceCookie=(await clientContext.cookies()).find(c=>c.name==="tl_client_evidence_"+jobId)!;
  for(const scopedCookie of [cookie,evidenceCookie]){expect(scopedCookie.httpOnly).toBe(true);expect(scopedCookie.secure).toBe(true);expect(scopedCookie.sameSite).toBe("Lax");}
  expect(cookie.path).toBe(publicPath);expect(evidenceCookie.path).toBe("/api/evidence/"+jobId);
  await provider.getByRole("button",{name:"Revoke client access",exact:true}).click();await confirm(provider);
  await client.reload();await expect(client.getByText("You are viewing the public agreement.",{exact:false})).toBeVisible();await expect(client.getByRole("heading",{name:"Participants",exact:true})).toBeVisible();await expect(client.locator("#transaction-participants-heading")).toHaveCount(0);
  await provider.getByRole("button",{name:"Replace client link",exact:true}).click();await confirm(provider);const reissued=await provider.getByLabel("Private client link").inputValue();
  await client.goto(reissued);await expect(client.getByText("Client review",{exact:true})).toBeVisible();
  const reissuedCookie=(await clientContext.cookies()).find(c=>c.name==="tl_client_"+publicId)!;const reissuedEvidenceCookie=(await clientContext.cookies()).find(c=>c.name==="tl_client_evidence_"+jobId)!;
  expect(reissuedCookie.path).toBe(publicPath);expect(reissuedEvidenceCookie.path).toBe("/api/evidence/"+jobId);
  await clientContext.addCookies([{...reissuedCookie,value:"0".repeat(64)},{...reissuedEvidenceCookie,value:"0".repeat(64)}]);await client.reload();await expect(client.getByText("You are viewing the public agreement.",{exact:false})).toBeVisible();
  expect(errors).toEqual([]);
  await clientContext.close();await outsiderContext.close();await adminContext.close();
});

test("Supabase sessions enforce trusted roles, secure cookies and logout",async({browser})=>{
  const rejectedContext=await browser.newContext({baseURL:"http://127.0.0.1:3001"});const rejected=await rejectedContext.newPage();
  await rejected.goto("/login");await rejected.getByLabel("Email address").fill("provider@example.test");await rejected.getByLabel(/password/i).fill("wrong-password");await rejected.getByRole("button",{name:/log in/i}).click();
  await expect(rejected.locator("main").getByRole("alert")).toContainText("couldn't sign you in");await expect(rejected).toHaveURL(/\/login$/);
  const forgedContext=await browser.newContext({baseURL:"http://127.0.0.1:3001"});
  await forgedContext.addCookies([{name:"tl_session_token",value:Buffer.from("forged:admin:ADMIN").toString("base64"),domain:"127.0.0.1",path:"/"}]);
  const forged=await forgedContext.newPage();await forged.goto("/dashboard");await expect(forged).toHaveURL(/\/login$/);

  const providerContext=await browser.newContext({baseURL:"http://127.0.0.1:3001"});const provider=await providerContext.newPage();
  await login(provider,"provider@example.test");
  await expectReachable(provider,["/dashboard","/dashboard/jobs","/dashboard/jobs/new","/dashboard/profile","/dashboard/settings"]);
  await provider.goto("/account");await expect(provider.getByRole("heading",{name:/Welcome, Ada Provider/})).toBeVisible();await provider.getByRole("link",{name:"Provider workspace",exact:true}).click();await expect(provider).toHaveURL(/\/dashboard$/);
  const authCookies=(await providerContext.cookies()).filter(cookie=>cookie.name.startsWith("sb-"));
  expect(authCookies.length).toBeGreaterThan(0);
  for(const cookie of authCookies){expect(cookie.httpOnly).toBe(true);expect(cookie.secure).toBe(true);expect(cookie.sameSite).toBe("Lax");}
  await provider.goto("/admin");await expect(provider.getByRole("heading",{name:"Page not found.",exact:true})).toBeVisible();
  await provider.goto("/dashboard");await provider.getByRole("button",{name:"Sign out",exact:true}).click();await expect(provider).toHaveURL(/\/login$/);
  await provider.goto("/dashboard");await expect(provider).toHaveURL(/\/login$/);

  const metadataContext=await browser.newContext({baseURL:"http://127.0.0.1:3001"});const metadata=await metadataContext.newPage();
  await login(metadata,"metadata-admin@example.test");await metadata.goto("/admin");await expect(metadata.getByRole("heading",{name:"Page not found.",exact:true})).toBeVisible();

  const adminContext=await browser.newContext({baseURL:"http://127.0.0.1:3001"});const admin=await adminContext.newPage();
  await login(admin,"admin@example.test",/\/admin$/);await expectReachable(admin,["/admin","/admin/users","/admin/jobs","/admin/disputes","/admin/events","/admin/validation"]);await expect(admin.getByRole("heading",{name:"Product signals",exact:true})).toBeVisible();
  await checkWidths(admin);
  for(const width of [390,1440]){await admin.setViewportSize({width,height:900});if(width===390)await expect(admin.getByText("Accepted providers",{exact:true}).first()).toBeVisible();await admin.screenshot({path:`test-results/validation-${width}.png`,fullPage:true});}
  await admin.goto("/dashboard/jobs/new");await expect(admin.getByRole("heading",{name:"Page not found.",exact:true})).toBeVisible();
  await rejectedContext.close();await forgedContext.close();await providerContext.close();await metadataContext.close();await adminContext.close();
});

test("a customer can sign up, enable a private provider draft, and switch workspaces",async({page})=>{
  const email="new-customer@example.test";
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("New Customer");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Choose password").fill("fixture-password-only");
  await page.getByRole("button",{name:"Create account",exact:false}).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("heading",{name:"Welcome, New Customer",exact:true})).toBeVisible();
  await expect(page.getByRole("link",{name:"Become a provider",exact:true}).first()).toBeVisible();

  await page.goto("/dashboard");
  await expect(page.getByRole("heading",{name:"Page not found.",exact:true})).toBeVisible();
  await page.goto("/account/become-provider");
  await page.getByLabel("Professional headline").fill("Website developer");
  await page.getByLabel("Service area").fill("Ikeja, Lagos");
  await page.getByRole("button",{name:"Enable provider workspace",exact:true}).click();
  await expect(page).toHaveURL(/\/dashboard\/profile$/);
  await expect(page.getByText("Profile status: Draft",{exact:true})).toBeVisible();
  await expect(page.getByText("This provider draft is private.",{exact:false})).toBeVisible();
  await expect(page.getByRole("link",{name:/View public Trust Profile/})).toHaveCount(0);

  await page.goto("/dashboard/settings");
  const draftProfilePath=await page.locator("dd.record-id").innerText();
  await page.goto(draftProfilePath);
  await expect(page.getByRole("heading",{name:"Page not found.",exact:true})).toBeVisible();
  await page.goto("/account");
  await expect(page.getByRole("link",{name:"Open provider workspace",exact:true})).toBeVisible();
  await page.getByRole("link",{name:"Open provider workspace",exact:true}).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("button",{name:"Sign out",exact:true}).click();
  await expect(page).toHaveURL(/\/login$/);
  await login(page,email);
});

test("a provider can configure services, service areas, availability, preview, and publication",async({page})=>{
  test.setTimeout(180000);
  await mockGeolocation(page);
  await login(page,"marketplace@example.test");
  await page.goto("/dashboard/services");
  await expect(page.getByRole("heading",{name:"Your marketplace services",exact:true})).toBeVisible();
  await expect(page.getByText("You have not created a marketplace service yet.",{exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Publish marketplace profile",exact:true})).toBeDisabled();

  await page.getByRole("link",{name:"Add a service",exact:true}).click();
  await expect(page).toHaveURL(/\/dashboard\/services\/new$/);
  await page.getByLabel("Category").selectOption({label:"Technology & Digital"});
  await page.getByRole("combobox",{name:"Service",exact:true}).selectOption({label:"Website Development"});
  await page.getByLabel("Public service title").fill("Premium business website");
  await page.getByLabel("Description").fill("Design and development of a responsive business website with clear scope and deployment support.");
  await page.getByLabel("Pricing model").selectOption("STARTING_AT");
  await page.getByLabel("Minimum price (NGN)").fill("85000");
  await page.getByLabel("Maximum price (optional)").fill("250000");
  await page.getByLabel("Available durations in minutes").fill("60, 120");
  await page.getByLabel("On-site service").check();
  await page.getByLabel("State or FCT").selectOption({label:"Lagos"});
  await page.getByLabel("LGA or area council (optional)").selectOption({label:"Ikeja"});
  await page.getByLabel("Approximate origin (optional)").fill("Ikeja area");
  await page.getByLabel("Travel radius in km (optional)").fill("25");
  await page.getByLabel(/Make this service active/).check();
  await page.getByRole("button",{name:"Create service",exact:true}).click();
  await expect(page).toHaveURL(/\/dashboard\/services$/);
  await expect(page.getByRole("heading",{name:"Premium business website",exact:true})).toBeVisible();
  await expect(page.getByText("Active",{exact:true})).toBeVisible();

  await page.goto("/dashboard/availability");
  await page.getByRole("checkbox",{name:"Monday",exact:true}).check();
  await page.getByLabel("Monday start time").fill("09:00");
  await page.getByLabel("Monday end time").fill("17:00");
  await page.getByRole("button",{name:"Save weekly hours",exact:true}).click();
  await expect(page.getByRole("status")).toContainText("Weekly availability saved");
  await page.getByLabel("Starts").fill("2026-12-24T09:00");
  await page.getByLabel("Ends").fill("2026-12-26T17:00");
  await page.getByLabel("Private note (optional)").fill("Private family leave");
  await page.getByRole("button",{name:"Add blackout period",exact:true}).click();
  await expect(page.getByText("Private family leave",{exact:false})).toBeVisible();

  await page.goto("/dashboard/profile/preview");
  await expect(page.getByRole("heading",{name:"Premium business website",exact:true})).toBeVisible();
  await expect(page.getByText(/Ikeja area, Ikeja, Lagos/)).toBeVisible();
  await expect(page.getByText("Monday",{exact:true})).toBeVisible();
  await expect(page.getByText("Private family leave",{exact:false})).toHaveCount(0);
  const previewHtml=await page.locator("main").innerHTML();
  expect(previewHtml).not.toContain("latitude");expect(previewHtml).not.toContain("longitude");expect(previewHtml).not.toContain("private_address");

  await page.goto("/dashboard/services");
  await page.getByRole("button",{name:"Publish marketplace profile",exact:true}).click();
  await expect(page.getByText(/Status: Published/)).toBeVisible();
  await expect(page.getByRole("button",{name:"Unpublish marketplace profile",exact:true})).toBeVisible();
  await page.getByRole("link",{name:"Edit",exact:true}).click();
  await page.getByRole("button",{name:"Use my current location",exact:true}).click();
  await expect(page.getByRole("status")).toContainText("Nearby matching is enabled");
  await page.getByLabel("Public service title").fill("Premium company website");
  await page.getByRole("button",{name:"Save service",exact:true}).click();
  await expect(page).toHaveURL(/\/dashboard\/services$/);
  await expect(page.getByRole("heading",{name:"Premium company website",exact:true})).toBeVisible();

  await page.getByRole("button",{name:"Unpublish marketplace profile",exact:true}).click();
  await expect(page.getByText(/Status: Private draft/)).toBeVisible();
  await page.getByRole("button",{name:"Archive",exact:true}).click();
  await expect(page.getByText("Archived",{exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Publish marketplace profile",exact:true})).toBeDisabled();
});

test("published provider discovery supports server filters and transient nearby matching",async({page})=>{
  await mockGeolocation(page);
  await page.goto("/");
  await expect(page.getByRole("heading",{name:"Business website development",exact:true}).first()).toBeVisible();
  await expect(page.getByText("Discovery Studio",{exact:true}).first()).toBeVisible();
  await page.goto("/providers?q=website&category=technology-digital&state=NG025&lga=NG025011&remote=1&date=2026-10-05");
  await expect(page.getByRole("heading",{name:"Business website development",exact:true})).toBeVisible();
  const discoveryCard=page.locator("article").filter({hasText:"Discovery Studio"});
  await expect(discoveryCard.getByText("Availability checked",{exact:true})).toBeVisible();
  await expect(discoveryCard.getByRole("link",{name:"View profile",exact:false})).toHaveAttribute("href","/p/discovery-studio");
  const publicHtml=await page.locator("main").innerHTML();
  for(const privateName of ["origin_latitude","origin_longitude","private_address"])expect(publicHtml).not.toContain(privateName);

  await page.goto("/providers?q=website&nearby=1&radius=5&sort=nearest");
  await page.getByRole("button",{name:"Use my location",exact:true}).click();
  await expect(page.getByText(/provider services? within 5 km/)).toBeVisible();
  await expect(page.getByRole("heading",{name:"Business website development",exact:true})).toBeVisible();
  await expect(page.getByText(/km away/)).toBeVisible();
  expect(page.url()).not.toMatch(/latitude|longitude|6\.6018|3\.3515/);
});

test("password recovery is non-enumerating, rejects invalid links, and rotates credentials",async({page})=>{
  await page.goto("/forgot-password");
  await page.getByLabel("Email address").fill("missing@example.test");
  await page.getByRole("button",{name:"Send reset link",exact:true}).click();
  await expect(page.getByRole("status")).toHaveText("If an account exists for that email, a password reset link will arrive shortly.");

  await page.getByLabel("Email address").fill("provider@example.test");
  await page.getByRole("button",{name:"Send reset link",exact:true}).click();
  await expect(page.getByRole("status")).toHaveText("If an account exists for that email, a password reset link will arrive shortly.");

  await page.goto("/auth/recovery?token_hash=invalid&type=recovery");
  await expect(page).toHaveURL(/\/login\?recovery=failed$/);
  await expect(page.locator("main").getByRole("alert")).toContainText("invalid or expired");

  await page.goto("/auth/recovery?token_hash=fixture-recovery-token&type=recovery");
  await expect(page).toHaveURL(/\/reset-password$/);
  await page.getByLabel(/^New password/).fill("replacement-password");
  await page.getByLabel(/^Confirm new password/).fill("replacement-password");
  await page.getByRole("button",{name:"Change password",exact:true}).click();
  await expect(page).toHaveURL(/\/login\?recovery=updated$/);
  await expect(page.locator("main").getByRole("status")).toContainText("password was changed");

  await page.getByLabel("Email address").fill("provider@example.test");
  await page.getByLabel(/^Password/).fill("fixture-password-only");
  await page.getByRole("button",{name:"Log in to TrustLink",exact:true}).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("couldn't sign you in");
  await page.getByLabel(/^Password/).fill("replacement-password");
  await page.getByRole("button",{name:"Log in to TrustLink",exact:true}).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});
