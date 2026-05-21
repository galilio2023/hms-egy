const fs = require('fs');
const path = require('path');

const schemaDir = path.join(__dirname, '..', 'db', 'schema');
const files = fs.readdirSync(schemaDir).filter(f => f.endsWith('.ts') && f !== 'index.ts' && f !== 'enums.ts' && f !== 'relations.ts');

const policyStr = `\n    tenantIsolation: pgPolicy("tenant_isolation_policy", { for: "all", to: "public", using: sql\`(current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid)\` }),`;

files.forEach(file => {
  const filePath = path.join(schemaDir, file);
  let content = fs.readFileSync(filePath, 'utf-8');
  let originalContent = content;

  // Add imports if missing
  if (!content.includes('pgPolicy')) {
    content = content.replace(/import {([^}]+)} from "drizzle-orm\/pg-core";/, (match, p1) => {
      return `import {${p1}, pgPolicy} from "drizzle-orm/pg-core";`;
    });
  }
  if (!content.includes('import { sql }')) {
    content = 'import { sql } from "drizzle-orm";\n' + content;
  }

  // Find all tables that have hospital_id
  // We look for: export const tableName = pgTable("table_name", { ... hospitalId: ... }, (table) => { ... });
  // OR without the third argument: export const tableName = pgTable("table_name", { ... hospitalId: ... });
  
  // This regex matches export const <name> = pgTable("<name>", { ... });
  // and we'll process it character by character or with a simpler logic.
  
  // Let's use a simpler approach: 
  // Split by 'export const '
  let parts = content.split('export const ');
  for (let i = 1; i < parts.length; i++) {
    let part = parts[i];
    if (part.includes('pgTable(') && part.includes('hospital_id')) {
      // It's a table with hospital_id.
      // We need to inject the policy into the 3rd arg.
      // Find the end of the second arg: `});` or `}, (table) => {`
      // We can search for the last `}` before the end of the pgTable call.
      
      // Let's find if it has a 3rd arg: `, (table) => {` or `, (t) => {`
      let thirdArgMatch = part.match(/}, \([a-zA-Z]+\) => {/);
      if (thirdArgMatch) {
        // Insert policy right after the `{` of the third arg return object
        // Wait, the third arg usually returns an object: `return { ... };`
        let returnMatch = part.match(/return \{/);
        if (returnMatch) {
           parts[i] = part.replace(/return \{/, 'return {' + policyStr);
        }
      } else {
        // No third arg. We need to add one.
        // Find the `});` at the end of the pgTable definition
        // Since we split by `export const`, the part ends where the next starts or EOF.
        // We look for the last `});` in this part.
        let lastIndex = part.lastIndexOf('});');
        if (lastIndex !== -1) {
          parts[i] = part.substring(0, lastIndex) + `}, (table) => {\n  return {${policyStr}\n  };\n});` + part.substring(lastIndex + 3);
        }
      }
    }
  }

  content = parts.join('export const ');

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log("Updated " + file);
  }
});
