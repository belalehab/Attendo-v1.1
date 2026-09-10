// generate_key.cjs
const jwt = require('jsonwebtoken');
const readline = require('readline');

// 🔒 MUST MATCH THE SECRET KEY IN YOUR MAIN.TS EXACTLY
const SECRET_KEY = 'Attendo_Secure_RSA_2026_!@#_Key';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log("\n==================================");
console.log("🔐 ATTENDO LICENSE GENERATOR");
console.log("==================================\n");

// 1. Prompt for Hardware ID
rl.question("💻 Enter the Machine Hardware ID: ", (clientHardwareId) => {
    if (!clientHardwareId.trim()) {
        console.error("\n❌ Hardware ID cannot be empty.");
        rl.close();
        return;
    }

    console.log("\n📦 Select Plan Type:");
    console.log("1 = Plus (1 User)");
    console.log("2 = Pro (2-4 Users)");
    console.log("3 = Ultimate (5+ Users)");
    
    rl.question("\nChoose Plan (1/2/3): ", (planChoice) => {
        let planType = "plus";
        if (planChoice.trim() === "2") planType = "pro";
        if (planChoice.trim() === "3") planType = "ultimate";

        console.log("\n⏳ Select License Duration:");
        console.log("1 = 1-Month Plan (30 Days)");
        console.log("2 = Semester (4 Months / 120 Days)");
        console.log("3 = Academic Year (12 Months / 365 Days) [10 Months + 2 FREE]");
        
        rl.question("\nChoose Duration (1/2/3): ", (durationChoice) => {
            let durationStr = "1 Month";
            let daysToAdd = 30;
            
            if (durationChoice.trim() === "2") {
                durationStr = "Semester (4 Months)";
                daysToAdd = 120;
            } else if (durationChoice.trim() === "3") {
                durationStr = "Academic Year (12 Months)";
                daysToAdd = 365;
            }

            const expirationDate = new Date();
            expirationDate.setDate(expirationDate.getDate() + daysToAdd);
            // Set to end of the day
            expirationDate.setHours(23, 59, 59, 999);
            
            const expTimestamp = Math.floor(expirationDate.getTime() / 1000);

            try {
                // Generate the token
                const token = jwt.sign(
                    { 
                        hwId: clientHardwareId.trim(), 
                        plan: planType,
                        duration: durationStr,
                        exp: expTimestamp
                    },
                    SECRET_KEY
                );

                console.log("\n✅ LICENSE GENERATED SUCCESSFULLY!\n");
                console.log(`💻 Bound Hardware ID: ${clientHardwareId.trim()}`);
                console.log(`📦 Subscription Plan: ${planType.toUpperCase()}`);
                console.log(`⏳ Duration:          ${durationStr}`);
                console.log(`📅 Exact Expiration:  ${expirationDate.toLocaleString()}\n`);
                console.log("🔑 COPY AND SEND THIS TOKEN TO THE INSTRUCTOR:\n");
                console.log(token);
                console.log("\n----------------------------------\n");

            } catch (error) {
                console.error("\n❌ Failed to generate key:", error.message);
            }

            rl.question("\nPress Enter to exit...", () => {
                rl.close(); 
            });
        });
    });
});