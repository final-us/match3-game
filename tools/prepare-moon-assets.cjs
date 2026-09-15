// Deterministic resizing only. Originals and pre-replacement resources stay outside the package.
const fs=require('fs'), path=require('path'), sharp=require('sharp');
const root=path.resolve(__dirname,'..');
const incoming=path.join(root,'assets/_incoming/moon-ui-runtime');
const generated='/Users/Admin/.codex/generated_images/01a0342c-1f4b-7f10-93f6-93fce15e1d60';
async function put(source,target,w,h,jpeg=false){
  const dest=path.join(root,'match3-wechat/res',target);
  const backup=path.join(incoming,'previous',target);
  fs.mkdirSync(path.dirname(backup),{recursive:true});
  if(fs.existsSync(dest) && !fs.existsSync(backup)) fs.copyFileSync(dest,backup);
  let img=sharp(source).resize(w,h,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}});
  await (jpeg?img.jpeg({quality:88}):img.png({compressionLevel:9})).toFile(dest);
}
(async()=>{
  if (process.argv.includes('--map-results-only')) {
    const source=path.join(incoming,'map-results/map-source.png');
    fs.copyFileSync(path.join(generated,'exec-6ebd1eb9-ca6d-4b77-a54f-1a2f118143b2.png'),source);
    const lastMap=path.join(incoming,'map-results/previous-level-background.jpg');
    if(!fs.existsSync(lastMap)) fs.copyFileSync(path.join(root,'match3-wechat/res/level-background-v2.jpg'),lastMap);
    await put(source,'level-background-v2.jpg',640,1384,true);
    await put(path.join(incoming,'map-results/happy-alpha/transparent.png'),'ui/result-happy-cat.png',320,320);
    await put(path.join(incoming,'map-results/sad-alpha/transparent.png'),'ui/result-sad-cat.png',320,320);
    return;
  }
  if (process.argv.includes('--support-icons-only')) {
    for (const id of ['hammer','bomb','yarn']) {
      await put(path.join(incoming,`support-polish/${id}-alpha/transparent.png`),`ui/tool-${id}.png`,160,160);
    }
    return;
  }
  if (process.argv.includes('--button-icons-only')) {
    await put(path.join(incoming,'button-polish/duel-alpha/transparent.png'),'home/duel-heads.png',256,171);
    await put(path.join(incoming,'button-polish/shop-alpha/transparent.png'),'ui/shop.png',144,144);
    await put(path.join(incoming,'button-polish/settings-alpha/transparent.png'),'ui/settings.png',144,144);
    return;
  }
  if (process.argv.includes('--title-reference-only')) {
    await put(path.join(incoming,'title-contour/transparent.png'),'home/title-logo.png',748,374);
    return;
  }
  if (process.argv.includes('--hero-transparent-only')) {
    await put(path.join(incoming,'hero-contour/transparent.png'),'home/duel-cats.png',768,512);
    console.log('Prepared transparent moon hero; originals preserved.');
    return;
  }
  if (process.argv.includes('--hero-card-only')) {
    const src=path.join(incoming,'hero-card/source.png');
    await put(src,'home/duel-cats.png',720,480);
    console.log('Prepared opaque hero card; previous resource preserved.');
    return;
  }
  if (process.argv.includes('--mint-only')) {
    const src=path.join(incoming,'piece5-regenerated-alpha/transparent.png');
    await put(src,'piece5-v2.png',512,512);
    await put(src,'piece5-runtime.png',256,256);
    console.log('Prepared mint review resource; previous piece preserved.');
    return;
  }
  const bg=path.join(incoming,'background.png');
  fs.copyFileSync(path.join(generated,'exec-c19e98bf-5b67-47ae-97e9-657121c01f68.png'),bg);
  for(const p of ['home/moonlit-garden-bg.jpg','game-background-v2.jpg','level-background-v2.jpg']) await put(bg,p,640,1384,true);
  await put(path.join(incoming,'title-alpha/transparent.png'),'home/title-logo.png',748,295);
  for(let i=1;i<=5;i++) {
    const src=path.join(incoming,i===5?'piece5-regenerated-alpha/transparent.png':`piece${i}-alpha/transparent.png`);
    if(!fs.existsSync(src)) continue;
    await put(src,`piece${i}-v2.png`,512,512);
    await put(src,`piece${i}-runtime.png`,256,256);
  }
  const sheets=[];
  for(let i=1;i<=4;i++) for(const [j,bgName] of ['white','dark'].entries()) {
    sheets.push({input:await sharp(path.join(incoming,`piece${i}-alpha/preview-${bgName}.png`)).resize(180,180).toBuffer(),left:(i-1)*180,top:j*180});
  }
  await sharp({create:{width:720,height:360,channels:4,background:'#ffffff'}}).composite(sheets).png().toFile(path.join(incoming,'alpha-review.png'));
  console.log('Prepared review resources; old originals preserved.');
})().catch(e=>{console.error(e);process.exitCode=1;});
