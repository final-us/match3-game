'use strict';
// Deterministic integration of the accepted concept: extract only the four
// unobscured illustration rectangles. UI/text are always drawn by the game.
const fs=require('fs'),path=require('path');
const source=path.resolve(__dirname,'../assets/_incoming/cat-catalog-v1/catalog-concept-v8-round-calico.png');
const target=path.resolve(__dirname,'../match3-wechat/res/catalog/portraits-atlas.jpg');
const {chromium}=require('/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/playwright');
const regions=[[91,264,350,350],[502,264,350,350],[91,890,350,388],[502,890,350,388]];
(async()=>{
    const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
    try {
        const page=await browser.newPage();
        const data=await page.evaluate(async({url,regions})=>{
            const img=new Image();img.src=url;await img.decode();
            if(img.width!==941||img.height!==1672)throw Error('Accepted source dimensions changed');
            const canvas=document.createElement('canvas');canvas.width=700;canvas.height=776;
            const ctx=canvas.getContext('2d');ctx.fillStyle='#ECE5EE';ctx.fillRect(0,0,700,776);
            regions.forEach((r,i)=>ctx.drawImage(img,...r,(i%2)*350,Math.floor(i/2)*388,r[2],r[3]));
            return canvas.toDataURL('image/jpeg',.84).split(',')[1];
        },{url:'data:image/png;base64,'+fs.readFileSync(source).toString('base64'),regions});
        fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,Buffer.from(data,'base64'));
        console.log(JSON.stringify({target,width:700,height:776,bytes:fs.statSync(target).size}));
    } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
