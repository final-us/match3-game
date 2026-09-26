'use strict';
// Deterministic resize of an accepted illustration, preserving its whole composition.
const fs=require('fs'),path=require('path');
const {chromium}=require('/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/playwright');
const names={2:['familiar','familiar'],3:['trust','trust'],4:['attachment','attachment'],5:['best-friend','best-friend']};
const stage=process.argv[2]||'2';
if(stage!=='--all-other'&&!names[stage])throw new Error('Choose accepted stage 2, 3, 4 or 5, or --all-other');
const jobs=stage==='--all-other'
    ? ['tuanzi','zhima','buding'].flatMap(prefix=>Object.keys(names).map(number=>({
        source:path.resolve(__dirname,'../assets/_incoming/cat-growth-complete-v1/'+prefix+'-stage-'+number+'-v1.png'),
        target:path.resolve(__dirname,'../match3-wechat/catalog/'+prefix+'-'+names[number][1]+'.jpg')
    })))
    : [{
        source:path.resolve(__dirname,'../assets/_incoming/cat-growth-naitang-v1/naitang-stage-'+stage+'-'+names[stage][0]+'-v1.png'),
        target:path.resolve(__dirname,'../match3-wechat/res/catalog/naitang-'+names[stage][1]+'.jpg')
    }];
(async()=>{
    const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
    try {
        const page=await browser.newPage();
        for(const {source,target} of jobs){
            const result=await page.evaluate(async url=>{
                const img=new Image();img.src=url;await img.decode();
                const scale=512/Math.max(img.width,img.height),canvas=document.createElement('canvas');
                canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);
                const ctx=canvas.getContext('2d');ctx.imageSmoothingQuality='high';ctx.drawImage(img,0,0,canvas.width,canvas.height);
                return {width:canvas.width,height:canvas.height,data:canvas.toDataURL('image/jpeg',.84).split(',')[1]};
            },'data:image/png;base64,'+fs.readFileSync(source).toString('base64'));
            fs.mkdirSync(path.dirname(target),{recursive:true});
            fs.writeFileSync(target,Buffer.from(result.data,'base64'));
            console.log(JSON.stringify({target,width:result.width,height:result.height,bytes:fs.statSync(target).size}));
        }
    } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
