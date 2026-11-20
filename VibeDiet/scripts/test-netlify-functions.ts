import 'dotenv/config';
import v1Handler from '../netlify/functions/v1.mts';
import adminHandler from '../netlify/functions/admin.mts';

// Ensure a valid minimum-length admin token for test execution
if (!process.env.ADMIN_ACCESS_TOKEN || process.env.ADMIN_ACCESS_TOKEN.length < 16) {
  process.env.ADMIN_ACCESS_TOKEN = 'dummy_admin_secret_token_gate_pass_ci';
}

async function runTests() {
  console.log('🚀 Running Comprehensive Netlify Functions Verification...\n');
  let passed = 0;
  let failed = 0;

  const assert = (condition: boolean, name: string, details?: any) => {
    if (condition) {
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${name}`, details || '');
      failed++;
    }
  };

  const context: any = {};
  const today = new Date().toISOString().slice(0, 10);

  // 1. GET /v1/days/:date
  try {
    const req = new Request(`https://vibediet.app/v1/days/${today}`, {
      method: 'GET',
      headers: { Authorization: 'Bearer uid:test-user-123' },
    });
    const res = await v1Handler(req, context);
    const data = await res.json();
    assert(res.status === 200, 'GET /v1/days/:date returns 200');
    assert(data.success === true && data.day && data.day.date === today, 'GET /v1/days/:date payload valid', data);
  } catch (err: any) {
    assert(false, 'GET /v1/days/:date threw error', err.message);
  }

  // 2. POST /v1/days/:date/water
  try {
    const req = new Request(`https://vibediet.app/v1/days/${today}/water`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer uid:test-user-123',
      },
      body: JSON.stringify({ deltaMl: 500 }),
    });
    const res = await v1Handler(req, context);
    const data = await res.json();
    assert(res.status === 200, 'POST /v1/days/:date/water returns 200');
    assert(data.success === true && typeof data.waterMl === 'number', 'POST /v1/days/:date/water updates waterMl', data);
  } catch (err: any) {
    assert(false, 'POST /v1/days/:date/water threw error', err.message);
  }

  // 3. POST /v1/meals/manual
  let createdMealId = '';
  try {
    const req = new Request('https://vibediet.app/v1/meals/manual', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer uid:test-user-123',
      },
      body: JSON.stringify({
        date: today,
        slot: 'lunch',
        title: 'Grilled Salmon with Quinoa & Steamed Broccoli',
        items: [
          { name: 'Wild Atlantic Salmon', grams: 200, calories: 412, protein: 40.0, carbs: 0.0, fat: 26.0 },
          { name: 'Cooked Quinoa', grams: 150, calories: 180, protein: 6.0, carbs: 32.0, fat: 2.5 },
          { name: 'Steamed Broccoli', grams: 100, calories: 35, protein: 2.8, carbs: 7.2, fat: 0.4 },
        ],
        totalCalories: 627,
        totalProtein: 48.8,
        totalCarbs: 39.2,
        totalFat: 28.9,
      }),
    });
    const res = await v1Handler(req, context);
    const data = await res.json();
    assert(res.status === 201, 'POST /v1/meals/manual returns 201');
    assert(data.success === true && data.meal && data.meal.id, 'POST /v1/meals/manual returns created meal', data);
    createdMealId = data.meal?.id;
  } catch (err: any) {
    assert(false, 'POST /v1/meals/manual threw error', err.message);
  }

  // 4. DELETE /v1/meals/:id
  try {
    const mealIdToDelete = createdMealId || 'sample-meal-id';
    const req = new Request(`https://vibediet.app/v1/meals/${mealIdToDelete}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer uid:test-user-123' },
    });
    const res = await v1Handler(req, context);
    const data = await res.json();
    assert(res.status === 200, 'DELETE /v1/meals/:id returns 200');
    assert(data.success === true && data.mealId === mealIdToDelete, 'DELETE /v1/meals/:id returns deleted id', data);
  } catch (err: any) {
    assert(false, 'DELETE /v1/meals/:id threw error', err.message);
  }

  // 5. GET /v1/weights & POST /v1/weights
  try {
    const postReq = new Request('https://vibediet.app/v1/weights', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer uid:test-user-123',
      },
      body: JSON.stringify({
        date: today,
        weightKg: 75.8,
        trendKg: 75.9,
      }),
    });
    const postRes = await v1Handler(postReq, context);
    const postData = await postRes.json();
    assert(postRes.status === 201, 'POST /v1/weights returns 201');
    assert(postData.success === true && postData.weight?.weightKg === 75.8, 'POST /v1/weights stores weight entry');

    const getReq = new Request('https://vibediet.app/v1/weights', {
      method: 'GET',
      headers: { Authorization: 'Bearer uid:test-user-123' },
    });
    const getRes = await v1Handler(getReq, context);
    const getData = await getRes.json();
    assert(getRes.status === 200, 'GET /v1/weights returns 200');
    assert(getData.success === true && Array.isArray(getData.weights), 'GET /v1/weights returns weights array');
  } catch (err: any) {
    assert(false, 'Weights endpoints threw error', err.message);
  }

  // 6. GET /v1/biometrics & PUT /v1/biometrics
  try {
    const putReq = new Request('https://vibediet.app/v1/biometrics', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer uid:test-user-123',
      },
      body: JSON.stringify({
        age: 29,
        gender: 'male',
        heightCm: 180,
        weightKg: 75.8,
        activityLevel: 'very_active',
        goalMode: 'lean_mass',
        targetCalories: 2400,
        macroSplit: { proteinPct: 35, carbPct: 40, fatPct: 25 },
      }),
    });
    const putRes = await v1Handler(putReq, context);
    const putData = await putRes.json();
    assert(putRes.status === 200, 'PUT /v1/biometrics returns 200');
    assert(putData.success === true && putData.biometrics?.targetCalories === 2400, 'PUT /v1/biometrics updates biometrics');

    const getReq = new Request('https://vibediet.app/v1/biometrics', {
      method: 'GET',
      headers: { Authorization: 'Bearer uid:test-user-123' },
    });
    const getRes = await v1Handler(getReq, context);
    const getData = await getRes.json();
    assert(getRes.status === 200, 'GET /v1/biometrics returns 200');
    assert(getData.success === true && getData.biometrics, 'GET /v1/biometrics returns biometrics payload');
  } catch (err: any) {
    assert(false, 'Biometrics endpoints threw error', err.message);
  }

  // 7. GET /v1/support & POST /v1/support
  try {
    const postReq = new Request('https://vibediet.app/v1/support', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer uid:test-user-123',
      },
      body: JSON.stringify({
        category: 'nutrition_fix',
        subject: 'Calorie goal auto-calibration',
        message: 'Requesting review of baseline expenditure target.',
      }),
    });
    const postRes = await v1Handler(postReq, context);
    const postData = await postRes.json();
    assert(postRes.status === 201, 'POST /v1/support returns 201');
    assert(postData.success === true && postData.ticket?.id.startsWith('TKT-'), 'POST /v1/support generates ticket');

    const getReq = new Request('https://vibediet.app/v1/support', {
      method: 'GET',
      headers: { Authorization: 'Bearer uid:test-user-123' },
    });
    const getRes = await v1Handler(getReq, context);
    const getData = await getRes.json();
    assert(getRes.status === 200, 'GET /v1/support returns 200');
    assert(getData.success === true && Array.isArray(getData.tickets), 'GET /v1/support returns tickets list');
  } catch (err: any) {
    assert(false, 'Support endpoints threw error', err.message);
  }

  // 8. GET /v1/admin/overview (Zero-Trust Security Gate: 401 unauthenticated, 200 with valid admin token)
  try {
    const unauthReq = new Request('https://vibediet.app/v1/admin/overview', {
      method: 'GET',
    });
    const unauthRes = await adminHandler(unauthReq, context);
    assert(unauthRes.status === 401, 'GET /v1/admin/overview denies unauthenticated requests (401)');

    const authReq = new Request('https://vibediet.app/v1/admin/overview', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${process.env.ADMIN_ACCESS_TOKEN}`,
      },
    });
    const authRes = await adminHandler(authReq, context);
    const authData = await authRes.json();
    assert(authRes.status === 200, 'GET /v1/admin/overview returns 200 with valid admin token');
    assert(authData.system && authData.keyPool && Array.isArray(authData.keySlots), 'GET /v1/admin/overview returns valid schema');
    assert(typeof authData.system.rssMb === 'number', 'GET /v1/admin/overview reports RSS memory');
  } catch (err: any) {
    assert(false, 'Admin overview threw error', err.message);
  }

  console.log(`\n🏁 Test Run Complete: ${passed} Passed, ${failed} Failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
