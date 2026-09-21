import { test, expect, type Page } from "@playwright/test";
async function login(page:Page,email:string) {
  await page.goto("/login");await page.getByLabel("Email address").fill(email);await page.getByLabel(/password/i).fill("fixture-password-only");await page.getByRole("button",{name:/log in/i}).click();await expect(page).toHaveURL(/\/dashboard$/);
}
async function confirm(page:Page) { const button=page.getByRole("button",{name:"Confirm change",exact:true}); await button.click(); await expect(button).toHaveCount(0); }
async function checkWidths(page:Page) {
  for(const width of [375,390,414,430,768,1024,1280,1440,1920]){
    await page.setViewportSize({width,height:900});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),page.url()+" at "+width).toBe(false);
  }
  await page.setViewportSize({width:1280,height:900});
}
test("provider/client/admin workflow through Supabase adapter and real PostgreSQL",async({browser,page:provider})=>{
  test.setTimeout(240000);
  const errors:string[]=[];provider.on("pageerror",e=>errors.push(e.message));
  await login(provider,"provider@example.test");
  await expect(provider.getByText("No transactions here yet")).toBeVisible();
  await checkWidths(provider);
  await provider.goto("/dashboard/jobs/new");
  await checkWidths(provider);
  for(const [label,value]of [["Service title","Audit workflow website"],["Service category","Web design"],["Agreed scope","A homepage and a contact page"],["Deliverables, one per line","Homepage\nContact page"],["Fee (NGN)","180000"],["Deadline","2099-10-18"],["Included revision rounds","1"],["Cancellation terms","Discuss cancellation before acceptance"]])await provider.getByLabel(label).fill(value);
  await provider.getByRole("button",{name:"Preview agreement"}).click();
  await provider.getByRole("checkbox").check();await provider.getByRole("button",{name:"Publish & create client link"}).click();
  const invite=await provider.getByLabel("Private client link").inputValue();
  await provider.getByRole("link",{name:"Open workspace",exact:true}).click();
  await expect(provider).toHaveURL(/\/dashboard\/jobs\/[a-f0-9-]{36}$/);
  const workspace=provider.url(),jobId=workspace.split("/").at(-1)!;
  await checkWidths(provider);
  const publicPath=new URL(invite).pathname;
  const clientContext=await browser.newContext({baseURL:"http://127.0.0.1:3001"});const client=await clientContext.newPage();client.on("pageerror",e=>errors.push(e.message));
  await client.goto(invite);await client.getByRole("button",{name:"Review & accept terms"}).click();
  await client.getByLabel("Your name or organization").fill("Private Client Name");await client.getByLabel("Your email").fill("private-client@example.test");await client.getByRole("checkbox").check();await client.getByRole("button",{name:"Confirm acceptance"}).click();
  await expect(client.getByText("Accepted",{exact:true})).toBeVisible();
  const outsiderContext=await browser.newContext({baseURL:"http://127.0.0.1:3001"});const outsider=await outsiderContext.newPage();
  await outsider.goto(publicPath);await expect(outsider.getByRole("button",{name:/accept|approve|record payment/i})).toHaveCount(0);
  expect(await outsider.content()).not.toContain("private-client@example.test");expect(await outsider.content()).not.toContain("clientActionTokenHash");
  await login(outsider,"other@example.test");await outsider.goto(workspace);await expect(outsider.getByRole("heading",{name:"Page not found.",exact:true})).toBeVisible();
  await provider.reload();await provider.getByRole("button",{name:"Record payment",exact:true}).click();await confirm(provider);
  await provider.getByRole("button",{name:"Start work",exact:true}).click();await provider.getByRole("button",{name:"Submit delivery",exact:true}).click();
  await provider.getByLabel("Describe your delivery").fill("First website delivery");
  const upload=provider.waitForResponse(r=>r.url().includes("/api/evidence/")&&r.request().method()==="POST");
  await provider.getByLabel("Private attachments (optional)").setInputFiles({name:"evidence.pdf",mimeType:"application/pdf",buffer:Buffer.from("%PDF-1.7\nTest evidence\n%%EOF")});
  const uploaded=await upload;expect(uploaded.status()).toBe(200);const file=await uploaded.json();
  await expect(provider.getByText("evidence.pdf",{exact:true})).toBeVisible();await confirm(provider);
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
  await client.reload();await client.getByRole("button",{name:"Open transaction dispute",exact:true}).click();await client.getByLabel("Details",{exact:true}).fill("Contact page is missing");await confirm(client);await expect(client.getByText("Disputed",{exact:true})).toBeVisible();
  const adminContext=await browser.newContext({baseURL:"http://127.0.0.1:3001"});const admin=await adminContext.newPage();await login(admin,"admin@example.test");await admin.goto("/disputes/"+jobId);await admin.getByRole("button",{name:"Resolve dispute",exact:true}).click();await admin.getByLabel("Details",{exact:true}).fill("Provider will submit the missing contact page");await confirm(admin);
  await provider.reload();await provider.getByRole("button",{name:"Submit delivery",exact:true}).click();await provider.getByLabel("Describe your delivery").fill("Complete website including contact page");await confirm(provider);
  await client.reload();await client.getByRole("button",{name:"Approve delivery",exact:true}).click();await confirm(client);await expect(client.getByText("Approved",{exact:true})).toBeVisible();
  await provider.reload();await provider.getByRole("button",{name:"Complete transaction",exact:true}).click();await expect(provider.getByText("Completed",{exact:true})).toBeVisible();
  await client.reload();await client.getByRole("button",{name:"Leave a review",exact:true}).click();await client.getByLabel("Client rating").selectOption("4");await client.getByLabel("Details",{exact:true}).fill("The record helped us resolve the missing page");await confirm(client);await expect(client.getByText("4 / 5",{exact:true})).toBeVisible();
  await provider.goto("/p/provider-11111111111141118111111111111111");await expect(provider.getByText("4.0",{exact:true})).toBeVisible();await expect(provider.getByText("Audit workflow website",{exact:true})).toBeVisible();
  await provider.goto(workspace);await provider.getByRole("button",{name:"Replace client link",exact:true}).click();await confirm(provider);const replacement=await provider.getByLabel("Private client link").inputValue();
  await client.reload();await expect(client.getByText("You are viewing the public agreement.",{exact:false})).toBeVisible();await client.goto(replacement);await expect(client.getByText("Client review",{exact:true})).toBeVisible();
  const cookie=(await clientContext.cookies()).find(c=>c.name.startsWith("tl_client_"))!;expect(cookie.httpOnly).toBe(true);expect(cookie.secure).toBe(true);
  await clientContext.addCookies([{...cookie,value:"0".repeat(64)}]);await client.reload();await expect(client.getByText("You are viewing the public agreement.",{exact:false})).toBeVisible();
  expect(errors).toEqual([]);
  await clientContext.close();await outsiderContext.close();await adminContext.close();
});
