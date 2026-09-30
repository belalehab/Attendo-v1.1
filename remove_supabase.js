import fs from 'fs';
let code = fs.readFileSync('src/tauriApi.ts', 'utf8');

const startRegex = /const hwId: string = await invoke\("get_hardware_id"\);[\s\S]*?msg: 'You have been offline for over 21 days\. Please connect to the internet to sync your license\.' \};\s*\}/m;

if (!startRegex.test(code)) {
    console.log("Could not find the block to remove.");
} else {
    code = code.replace(startRegex, "return { valid: true, warning: false, plan, duration, exp };");
    fs.writeFileSync('src/tauriApi.ts', code, 'utf8');
    console.log("Done");
}
