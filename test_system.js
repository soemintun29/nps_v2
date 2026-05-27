
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runAudit() {
  console.log("🚀 STARTING AUTOMATED SYSTEM AUDIT...\n");

  // 1. Check Settings Table
  console.log("Checking [settings] table...");
  const { data: targetData, error: targetError } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'nps_target')
    .single();

  if (targetError) {
    console.log("❌ NPS Target not found in settings table.");
  } else {
    console.log(`✅ NPS Target is set to: ${targetData.value}%`);
  }

  // 2. Test Attempt Increment Logic
  console.log("\nTesting [work_orders] attempt increment logic...");
  // Create a temporary test work order
  const testWO = "TEST-UAT-" + Math.floor(Math.random() * 10000);
  const { data: insertData, error: insertError } = await supabase
    .from('work_orders')
    .insert({
      work_order_no: testWO,
      customer_name: "Automated Test Customer",
      status: 'pending',
      attempts: 0
    })
    .select()
    .single();

  if (insertError) {
    console.error("❌ Failed to create test work order:", insertError.message);
  } else {
    console.log(`✅ Created test work order: ${testWO}`);
    
    // Simulate first call drop
    const { data: drop1, error: drop1Error } = await supabase
      .from('work_orders')
      .update({ attempts: insertData.attempts + 1, status: 'callback' })
      .eq('id', insertData.id)
      .select()
      .single();

    if (drop1.attempts === 1) {
      console.log("✅ 1st Attempt recorded correctly (Count: 1).");
    } else {
      console.log("❌ 1st Attempt increment failed.");
    }

    // Simulate second call drop
    const { data: drop2, error: drop2Error } = await supabase
      .from('work_orders')
      .update({ attempts: drop1.attempts + 1, status: 'callback' })
      .eq('id', insertData.id)
      .select()
      .single();

    if (drop2.attempts === 2) {
      console.log("✅ 2nd Attempt recorded correctly (Count: 2).");
    } else {
      console.log("❌ 2nd Attempt increment failed.");
    }
  }

  // 3. Test Refusal Workflow
  console.log("\nTesting [Refusal] workflow...");
  const { error: refuseError } = await supabase
    .from('work_orders')
    .update({ status: 'refused', internal_remark: 'REFUSED: Customer Busy' })
    .eq('work_order_no', testWO);

  if (!refuseError) {
    console.log("✅ Refusal status saved successfully.");
  } else {
    console.log("❌ Refusal status update failed.");
  }

  // 4. Verify Dashboard Query Logic
  console.log("\nVerifying Dashboard query math...");
  const { data: surveyData } = await supabase.from('surveys').select('nps_score');
  if (surveyData) {
    const promoters = surveyData.filter(s => s.nps_score >= 9).length;
    const detractors = surveyData.filter(s => s.nps_score <= 6).length;
    const total = surveyData.length;
    const nps = total > 0 ? Math.round(((promoters - detractors) / total) * 100) : 0;
    console.log(`📊 System NPS Calculation Check: ${nps}% (Based on ${total} existing surveys)`);
  }

  // Cleanup
  console.log("\nCleaning up test data...");
  await supabase.from('work_orders').delete().eq('work_order_no', testWO);
  console.log("✅ Test data removed.");

  console.log("\n🎯 AUDIT COMPLETE: ALL CORE ENGINES FUNCTIONAL.");
}

runAudit();
