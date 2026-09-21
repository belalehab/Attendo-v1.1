import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

const replacement = "  const processFile = async (file: File) => {\n" +
"    const toastId = toast.loading('Parsing CSV file...');\n" +
"    try {\n" +
"      const arrayBuffer = await file.arrayBuffer();\n" +
"      let fileText = '';\n" +
"      try {\n" +
"        const decoder = new TextDecoder('utf-8', { fatal: true });\n" +
"        fileText = decoder.decode(arrayBuffer);\n" +
"      } catch (e) {\n" +
"        const decoder = new TextDecoder('windows-1256');\n" +
"        fileText = decoder.decode(arrayBuffer);\n" +
"      }\n" +
"\n" +
"      Papa.parse(fileText, {\n" +
"        header: true,\n" +
"        skipEmptyLines: true,\n" +
"        complete: async (results) => {\n" +
"          const validStudents: any[] = [];\n" +
"          \n" +
"          results.data.forEach((row: any) => {\n" +
"            const rawName = row['Name'] || row['name'] || row['\\u0627\\u0644\\u0627\\u0633\\u0645'] || row['O U,O O3U.'] || row['O U,O O3U.'] || '';\n" +
"            const rawId = row['ID'] || row['id'] || row['\\u0627\\u0644\\u0631\\u0642\\u0645 \\u0627\\u0644\\u0642\\u0648\\u0645\\u064a'] || row['O U,OU,U. O U,U,U^U.US'] || row['O U,OU,U. O U,U,U^U.US'] || '';\n" +
"            const rawGrade = row['Grade'] || row['grade'] || row['\\u0627\\u0644\\u0641\\u0631\\u0642\\u0629'] || row['O U,U?OU,Oc'] || row['O U,U?OU,Oc'] || '';";

code = code.replace(/const processFile = async \(file: File\) => \{[\s\S]*?const rawGrade = row\[.*?\] \|\| '';/, replacement);
fs.writeFileSync('src/App.tsx', code, 'utf8');
console.log("Done");
