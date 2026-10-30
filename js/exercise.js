/* E-Diary — Notes & Life → Exercise (added in 1.16).
   Left page:  your weekly exercise plan — choose a ready plan for your goal (lose weight / chest & belly fat, build
               muscle, chest focus, beginner, home without equipment) and change any day; each day lists its
               exercises with sets × reps and how to do them; tick them off and log the workout. "Which exercises
               for…" explains what works for chest, belly, weight loss and muscle gain.
   Right page: activity — steps and workouts from the phone / watch app (read from its backup file in Google Drive,
               or a file you choose) together with what you add by hand; steps against your goal, calories burned,
               active minutes, the last 14 days, and the list of workouts.
   In the planner: each workout day of the plan is a repeating task "💪 Workout: …" under Health & Fitness.
   Data: ED.store.data.exercise = {
     plan: { tpl, name, time, inPlanner, days: { 0–6: { title, focus, mins, items: [{ k (exercise key) | name, sets, reps }] } } },
     log:  [{ id, date, kind, title, mins, kcal, steps, km, src: 'manual' | 'watch', ext, notes, updatedAt }],
     steps: { 'YYYY-MM-DD': { n, km, src } },  ticks: { 'YYYY-MM-DD': { index: 1 } },
     watch: { file, at, goal, heightCm, weightKg, device }, stepGoal } */
(function () {
  'use strict';
  const ED = window.ED, U = ED.util, M = ED.model, e = U.esc;
  const D = () => ED.store.data;
  const A = (ED.actions = ED.actions || {});
  const CH = (ED.changes = ED.changes || {});
  const FX = () => ED.fx;
  const XR = (ED.exercise = {});
  const st = () => ED.state.xr || (ED.state.xr = {});
  const XD = () => {
    const d = D();
    if (!d.exercise || typeof d.exercise !== 'object') d.exercise = {};
    const x = d.exercise;
    if (!Array.isArray(x.log)) x.log = [];
    if (!x.steps || typeof x.steps !== 'object') x.steps = {};
    if (!x.ticks || typeof x.ticks !== 'object') x.ticks = {};
    if (!x.watch || typeof x.watch !== 'object') x.watch = {};
    return x;
  };

  /* ---------------- the exercises ----------------
     key: [name, area, kind, equipment, MET, how to do it] — MET from the Compendium of Physical Activities (approx.) */
  const LIB = {
    pushup: ['Push-ups', 'chest', 'strength', 'none', 8, 'Hands a little wider than the shoulders, body in a straight line; lower the chest to a fist above the floor, push back up. Easier: hands on a table (incline) or knees down.'],
    inclinepush: ['Incline push-ups (hands on a bench)', 'chest', 'strength', 'none', 6, 'Hands on a bench or bed edge; easier than floor push-ups — good for beginners and for the lower chest.'],
    declinepush: ['Decline push-ups (feet raised)', 'chest', 'strength', 'none', 8, 'Feet on a step or bed, hands on the floor; works the upper chest and shoulders.'],
    widepush: ['Wide push-ups', 'chest', 'strength', 'none', 8, 'Hands wider than usual; more stretch for the chest.'],
    diamond: ['Diamond push-ups', 'chest', 'strength', 'none', 8, 'Thumbs and index fingers touching under the chest; works the inner chest and triceps.'],
    dbpress: ['Dumbbell bench / floor press', 'chest', 'strength', 'dumbbells', 6, 'Lie on a bench (or the floor), dumbbells at chest level, press up till the arms are straight, lower slowly in 2–3 seconds.'],
    inclinedb: ['Incline dumbbell press', 'chest', 'strength', 'dumbbells', 6, 'Bench at 30°; press up and slightly together — the upper chest.'],
    dbfly: ['Dumbbell fly', 'chest', 'strength', 'dumbbells', 5, 'On a bench, arms open wide with soft elbows, bring the dumbbells together over the chest like hugging a tree.'],
    bench: ['Barbell bench press', 'chest', 'strength', 'gym', 6, 'Grip a little wider than shoulders, lower the bar to mid-chest, press up; use a spotter for heavy sets.'],
    cablefly: ['Cable crossover', 'chest', 'strength', 'gym', 5, 'Pulleys high, step forward, bring the handles down and together in front of the hips; squeeze the chest.'],
    dips: ['Chest dips', 'chest', 'strength', 'gym', 8, 'On parallel bars, lean forward a little and lower till the shoulders are level with the elbows; push up.'],
    pecdeck: ['Pec deck machine', 'chest', 'strength', 'gym', 5, 'Elbows at shoulder height, bring the pads together, return slowly.'],
    dbrow: ['One-arm dumbbell row', 'back', 'strength', 'dumbbells', 6, 'One knee and hand on a bench, pull the dumbbell to the hip, squeeze the shoulder blade, lower slowly.'],
    superman: ['Superman', 'back', 'strength', 'none', 4, 'Lie face down, lift arms, chest and legs a little off the floor, hold 2 seconds, lower.'],
    bandpull: ['Band pull-apart', 'back', 'strength', 'band', 4, 'Hold a band at chest height, pull it apart till it touches the chest; good for posture.'],
    pulldown: ['Lat pull-down', 'back', 'strength', 'gym', 6, 'Pull the bar to the upper chest, elbows down and back, return slowly.'],
    cablerow: ['Seated cable row', 'back', 'strength', 'gym', 6, 'Sit tall, pull the handle to the stomach, squeeze the shoulder blades.'],
    pullup: ['Pull-ups (or assisted)', 'back', 'strength', 'gym', 8, 'Hang with straight arms, pull the chin over the bar; use a band or machine for help.'],
    revfly: ['Reverse dumbbell fly', 'back', 'strength', 'dumbbells', 5, 'Bend forward at the hips, raise the dumbbells out to the sides; the upper back and rear shoulders.'],
    pike: ['Pike push-ups', 'shoulders', 'strength', 'none', 7, 'Hips high in an upside-down V, bend the elbows to bring the head towards the floor, push back.'],
    ohp: ['Dumbbell shoulder press', 'shoulders', 'strength', 'dumbbells', 6, 'Sitting or standing, press the dumbbells from the shoulders to overhead, lower slowly.'],
    lateral: ['Lateral raise', 'shoulders', 'strength', 'dumbbells', 5, 'Raise the dumbbells out to the sides to shoulder height, elbows slightly bent.'],
    facepull: ['Face pull', 'shoulders', 'strength', 'gym', 5, 'Rope at face height, pull towards the forehead with elbows high.'],
    curl: ['Biceps curl', 'arms', 'strength', 'dumbbells', 5, 'Elbows by the sides, curl the dumbbells up, lower in 2–3 seconds.'],
    hammer: ['Hammer curl', 'arms', 'strength', 'dumbbells', 5, 'Palms facing each other, curl up; the forearms and biceps.'],
    chairdip: ['Triceps dips on a chair', 'arms', 'strength', 'none', 6, 'Hands on a chair behind you, lower by bending the elbows to 90°, push up.'],
    ohext: ['Overhead triceps extension', 'arms', 'strength', 'dumbbells', 5, 'One dumbbell held overhead with both hands, lower behind the head, straighten the arms.'],
    squat: ['Bodyweight squats', 'legs', 'strength', 'none', 5, 'Feet shoulder-width, sit back and down till the thighs are level with the floor, knees over the toes, stand up.'],
    goblet: ['Goblet squat', 'legs', 'strength', 'dumbbells', 6, 'Hold a dumbbell at the chest, squat deep with the chest up.'],
    lunge: ['Lunges', 'legs', 'strength', 'none', 6, 'Step forward, lower till both knees are at 90°, push back; alternate legs.'],
    glute: ['Glute bridge', 'legs', 'strength', 'none', 4, 'Lie on the back, knees bent, lift the hips till the body is straight from knees to shoulders, squeeze.'],
    stepup: ['Step-ups', 'legs', 'strength', 'none', 7, 'Step up onto a sturdy step or bench, drive through the front heel, step down.'],
    wallsit: ['Wall sit', 'legs', 'strength', 'none', 4, 'Back against a wall, thighs parallel to the floor; hold.'],
    calf: ['Calf raises', 'legs', 'strength', 'none', 4, 'Rise onto the toes, pause, lower slowly; on a step for more range.'],
    rdl: ['Romanian deadlift (dumbbells)', 'legs', 'strength', 'dumbbells', 6, 'Soft knees, push the hips back, lower the dumbbells along the legs till you feel the hamstrings, stand up.'],
    legpress: ['Leg press', 'legs', 'strength', 'gym', 6, 'Feet shoulder-width on the plate, lower till the knees are at 90°, press back.'],
    plank: ['Plank', 'core', 'strength', 'none', 4, 'On the forearms and toes, body straight, tummy pulled in; breathe normally. Hold.'],
    sideplank: ['Side plank', 'core', 'strength', 'none', 4, 'On one forearm, body straight sideways; hold, then the other side. The waist (obliques).'],
    deadbug: ['Dead bug', 'core', 'strength', 'none', 4, 'On the back, arms up, knees at 90°; lower the opposite arm and leg slowly keeping the lower back on the floor.'],
    bicycle: ['Bicycle crunches', 'core', 'strength', 'none', 5, 'Hands by the ears, bring the opposite elbow and knee together, alternate slowly.'],
    legraise: ['Lying leg raises', 'core', 'strength', 'none', 4, 'On the back, legs straight, raise to 90° and lower slowly without arching the back. The lower belly.'],
    climber: ['Mountain climbers', 'core', 'cardio', 'none', 8, 'Push-up position, drive the knees to the chest one after the other, fast.'],
    twist: ['Russian twist', 'core', 'strength', 'none', 4, 'Sit leaning back, feet up or down, turn the shoulders side to side.'],
    birddog: ['Bird dog', 'core', 'strength', 'none', 3, 'On hands and knees, stretch out the opposite arm and leg, hold 2 seconds, switch.'],
    walk: ['Brisk walk', 'cardio', 'cardio', 'none', 4.3, 'At a pace where you can talk but not sing (about 5–6 km/h).'],
    jog: ['Jog / run', 'cardio', 'cardio', 'none', 8, 'Easy pace first; build up time before speed.'],
    cycle: ['Cycling', 'cardio', 'cardio', 'cycle', 7, 'Moderate effort, 15–20 km/h on the flat, or a static cycle.'],
    skip: ['Skipping (jump rope)', 'cardio', 'cardio', 'rope', 11, 'Small jumps on the balls of the feet; 30–60 seconds on, 30 off.'],
    jacks: ['Jumping jacks', 'cardio', 'cardio', 'none', 8, 'Jump the feet apart while raising the arms overhead, jump back.'],
    burpee: ['Burpees', 'cardio', 'cardio', 'none', 10, 'Squat, hands down, jump the feet back to a plank, (push-up), jump the feet in and jump up.'],
    highknee: ['High knees', 'cardio', 'cardio', 'none', 8, 'Run on the spot bringing the knees to hip height.'],
    stairs: ['Stair climbing', 'cardio', 'cardio', 'none', 8, 'Up at a steady pace, walk down; hold the rail.'],
    swim: ['Swimming', 'cardio', 'cardio', 'pool', 7, 'Steady laps; easy on the joints.'],
    surya: ['Surya Namaskar (rounds)', 'mobility', 'mobility', 'none', 4, 'The 12-step sun salutation; slow with the breath. 12 rounds ≈ 15 minutes.'],
    kapal: ['Kapalbhati and Anulom-Vilom', 'mobility', 'mobility', 'none', 2, 'Sit straight; kapalbhati (quick out-breaths from the tummy) then alternate-nostril breathing. Skip kapalbhati with high BP, heart disease or pregnancy.'],
    chestopen: ['Doorway chest stretch', 'mobility', 'mobility', 'none', 2, 'Forearms on a door frame, step through gently till the chest stretches; 30 seconds.'],
    hamstring: ['Hamstring and hip stretch', 'mobility', 'mobility', 'none', 2, 'Hold each stretch 30 seconds without bouncing.'],
    catcow: ['Cat-cow and child’s pose', 'mobility', 'mobility', 'none', 2, 'On hands and knees, round and arch the back slowly; then sit back to the heels.'],
  };
  XR.LIB = LIB;
  const ex = k => LIB[k] ? { k, name: LIB[k][0], area: LIB[k][1], kind: LIB[k][2], equip: LIB[k][3], met: LIB[k][4], how: LIB[k][5] } : { k, name: k, area: 'other', kind: 'strength', equip: '', met: 5, how: '' };

  /* ---------------- ready plans ----------------
     each day: [title, focus, minutes, [[key, sets, reps], …]] — index 0 = Sunday */
  const I = (k, s, r) => [k, s, r];
  const TPL = {
    fatloss: { name: 'Lose weight, chest & belly fat (6 days)', note: 'Strength on 4 days keeps the muscle while you lose fat; cardio on every day burns more. Fat comes off the chest and belly as your overall body fat falls — with a calorie deficit (see Weekly meals).', days: {
      1: ['Chest + HIIT', 'Chest', 50, [I('pushup', 3, '10–15'), I('dbpress', 3, '10–12'), I('inclinedb', 3, '10–12'), I('dbfly', 3, '12'), I('declinepush', 2, '8–12'), I('burpee', 4, '30 s on / 30 s off'), I('climber', 3, '30 s')]],
      2: ['Legs + brisk walk', 'Legs', 55, [I('squat', 3, '15'), I('lunge', 3, '10 each leg'), I('glute', 3, '15'), I('rdl', 3, '12'), I('calf', 3, '20'), I('walk', 1, '30 min')]],
      3: ['Core + cardio', 'Belly', 45, [I('plank', 3, '30–45 s'), I('bicycle', 3, '20'), I('legraise', 3, '12'), I('sideplank', 2, '30 s each'), I('deadbug', 3, '10 each'), I('jog', 1, '20 min (or skipping 10 min)')]],
      4: ['Back & shoulders', 'Back', 45, [I('dbrow', 3, '12 each'), I('revfly', 3, '12'), I('ohp', 3, '10–12'), I('lateral', 3, '12–15'), I('superman', 3, '12'), I('chestopen', 1, '2 × 30 s')]],
      5: ['Full-body circuit', 'Full body', 45, [I('goblet', 3, '12'), I('pushup', 3, '12'), I('dbrow', 3, '12'), I('jacks', 3, '45 s'), I('climber', 3, '30 s'), I('plank', 3, '45 s')]],
      6: ['Long cardio + yoga', 'Cardio', 60, [I('cycle', 1, '45 min (or brisk walk 60 min)'), I('surya', 1, '12 rounds'), I('kapal', 1, '10 min')]],
      0: ['Rest / stretching', 'Rest', 20, [I('walk', 1, '20 min easy'), I('hamstring', 1, '5 min'), I('catcow', 1, '5 min')]],
    } },
    muscle: { name: 'Build muscle — Push / Pull / Legs (6 days)', note: '8–12 reps, last 2 reps hard; add a little weight or a rep each week (progressive overload). Eat enough protein (1.6 g per kg) and calories.', days: {
      1: ['Push: chest, shoulders, triceps', 'Chest', 60, [I('bench', 4, '8–10'), I('inclinedb', 3, '10'), I('ohp', 3, '10'), I('lateral', 3, '12–15'), I('dips', 3, '8–12'), I('ohext', 3, '12')]],
      2: ['Pull: back, biceps', 'Back', 60, [I('pullup', 4, '6–10'), I('cablerow', 3, '10'), I('dbrow', 3, '10 each'), I('facepull', 3, '15'), I('curl', 3, '10–12'), I('hammer', 3, '12')]],
      3: ['Legs + core', 'Legs', 60, [I('legpress', 4, '10'), I('rdl', 3, '10'), I('lunge', 3, '10 each'), I('calf', 4, '15'), I('plank', 3, '45 s'), I('legraise', 3, '12')]],
      4: ['Push (volume)', 'Chest', 55, [I('dbpress', 4, '10–12'), I('cablefly', 3, '12–15'), I('pecdeck', 3, '12'), I('pike', 3, '10'), I('chairdip', 3, '15')]],
      5: ['Pull (volume)', 'Back', 55, [I('pulldown', 4, '10–12'), I('revfly', 3, '15'), I('dbrow', 3, '12'), I('curl', 3, '12'), I('bandpull', 3, '20')]],
      6: ['Legs + cardio', 'Legs', 55, [I('goblet', 4, '12'), I('stepup', 3, '10 each'), I('glute', 3, '15'), I('wallsit', 3, '45 s'), I('cycle', 1, '20 min')]],
      0: ['Rest', 'Rest', 15, [I('walk', 1, '20–30 min easy'), I('catcow', 1, '5 min')]],
    } },
    chest: { name: 'Chest focus + fat loss (5 days)', note: 'Three chest days build and firm the chest muscles; cardio and the meal plan bring the fat over them down. Spot reduction does not work — the whole body loses fat together.', days: {
      1: ['Chest — strength', 'Chest', 50, [I('dbpress', 4, '8–10'), I('inclinedb', 4, '8–10'), I('dbfly', 3, '12'), I('pushup', 3, 'as many as you can'), I('walk', 1, '15 min')]],
      2: ['Legs + core + cardio', 'Legs', 50, [I('squat', 3, '15'), I('lunge', 3, '10 each'), I('plank', 3, '45 s'), I('bicycle', 3, '20'), I('jog', 1, '15 min')]],
      3: ['Chest — volume', 'Chest', 45, [I('inclinepush', 3, '15'), I('widepush', 3, '12'), I('declinepush', 3, '10'), I('diamond', 3, '8–10'), I('climber', 4, '30 s')]],
      4: ['Back + HIIT', 'Back', 45, [I('dbrow', 3, '12 each'), I('revfly', 3, '12'), I('superman', 3, '12'), I('burpee', 5, '30 s on / 30 s off')]],
      5: ['Chest + arms', 'Chest', 50, [I('dbpress', 3, '10–12'), I('dbfly', 3, '12–15'), I('chairdip', 3, '12–15'), I('curl', 3, '12'), I('skip', 5, '1 min')]],
      6: ['Long walk / cycling', 'Cardio', 60, [I('cycle', 1, '45–60 min'), I('chestopen', 1, '2 × 30 s')]],
      0: ['Rest', 'Rest', 0, []],
    } },
    beginner: { name: 'Beginner — full body (3 days) + walking', note: 'Start here if you have not trained for a while. Two sets the first two weeks, then three. Walk on the other days.', days: {
      1: ['Full body A', 'Full body', 40, [I('squat', 3, '12'), I('inclinepush', 3, '10'), I('superman', 3, '10'), I('glute', 3, '12'), I('plank', 3, '20–30 s'), I('walk', 1, '15 min')]],
      2: ['Brisk walk', 'Cardio', 30, [I('walk', 1, '30 min')]],
      3: ['Full body B', 'Full body', 40, [I('lunge', 3, '8 each'), I('pushup', 3, '6–10 (knees down is fine)'), I('dbrow', 3, '10 each'), I('birddog', 3, '8 each'), I('deadbug', 3, '8 each'), I('walk', 1, '15 min')]],
      4: ['Brisk walk', 'Cardio', 30, [I('walk', 1, '30 min')]],
      5: ['Full body A', 'Full body', 40, [I('squat', 3, '12'), I('inclinepush', 3, '10'), I('superman', 3, '10'), I('glute', 3, '12'), I('plank', 3, '20–30 s'), I('walk', 1, '15 min')]],
      6: ['Yoga + walk', 'Mobility', 40, [I('surya', 1, '6–8 rounds'), I('walk', 1, '30 min')]],
      0: ['Rest', 'Rest', 0, []],
    } },
    home: { name: 'At home, no equipment (5 days)', note: 'Only your body weight and a chair. Make it harder by slowing down (3 seconds down) or adding reps.', days: {
      1: ['Chest & triceps', 'Chest', 35, [I('pushup', 4, '10–15'), I('widepush', 3, '10'), I('declinepush', 3, '8–12'), I('diamond', 3, '8'), I('chairdip', 3, '12')]],
      2: ['Legs & glutes', 'Legs', 35, [I('squat', 4, '15–20'), I('lunge', 3, '12 each'), I('stepup', 3, '12 each'), I('glute', 3, '15'), I('wallsit', 3, '45 s')]],
      3: ['HIIT + core', 'Belly', 30, [I('jacks', 4, '40 s'), I('burpee', 4, '30 s'), I('highknee', 4, '30 s'), I('plank', 3, '45 s'), I('legraise', 3, '12'), I('bicycle', 3, '20')]],
      4: ['Back & shoulders', 'Back', 30, [I('superman', 4, '12'), I('pike', 3, '8–10'), I('birddog', 3, '10 each'), I('sideplank', 3, '30 s each')]],
      5: ['Full body circuit', 'Full body', 35, [I('burpee', 3, '10'), I('squat', 3, '20'), I('pushup', 3, '12'), I('climber', 3, '40 s'), I('plank', 3, '60 s')]],
      6: ['Walk + Surya Namaskar', 'Cardio', 45, [I('walk', 1, '30 min'), I('surya', 1, '12 rounds')]],
      0: ['Rest', 'Rest', 0, []],
    } },
  };
  XR.TPL = TPL;
  const GUIDE = [
    ['Chest (firm the chest, less chest fat)', 'chest', 'Push-ups (incline → standard → decline), dumbbell press, incline press and fly, 2–3 times a week, 3 sets of 8–15. Chest fat (and “man boobs”) goes down only with overall fat loss — add cardio and a calorie deficit; the exercises build the muscle underneath so the chest looks firm.', ['pushup', 'inclinepush', 'dbpress', 'inclinedb', 'dbfly', 'declinepush']],
    ['Stomach / belly fat', 'core', 'Crunches alone do not burn belly fat. What works: a calorie deficit (Weekly meals), 150–300 minutes of brisk cardio a week, strength training 3 times a week, 7–8 hours of sleep and less sugar. Core exercises then tone the waist and protect the back.', ['plank', 'sideplank', 'deadbug', 'bicycle', 'legraise', 'climber', 'walk']],
    ['Weight loss', 'cardio', 'Aim to lose 0.25–0.75 kg a week: about 300–700 kcal a day below what you burn. Walk 8,000–10,000 steps a day, add 3–5 cardio sessions (walk, cycle, jog, skipping) and keep 2–4 strength days so the weight lost is fat, not muscle.', ['walk', 'cycle', 'jog', 'skip', 'burpee', 'squat']],
    ['Increase muscle mass', 'strength', 'Train each muscle twice a week, 10–20 hard sets per muscle per week, 6–12 reps close to failure, and add weight or reps every week. Eat 1.6–2.2 g protein per kg and a small calorie surplus (+250–300 kcal); sleep 7–9 hours.', ['bench', 'dbpress', 'pullup', 'dbrow', 'ohp', 'legpress', 'rdl', 'curl']],
  ];

  /* ---------------- the plan ---------------- */
  XR.plan = () => { const x = XD(); return x.plan && x.plan.days ? x.plan : null; };
  const useTpl = key => {
    const t = TPL[key]; if (!t) return;
    const old = XR.plan() || {};
    const days = {}; Object.keys(t.days).forEach(d => { const v = t.days[d]; days[d] = { title: v[0], focus: v[1], mins: v[2], items: v[3].map(i => ({ k: i[0], sets: i[1], reps: i[2] })) }; });
    XD().plan = { tpl: key, name: t.name, time: old.time || '06:30', inPlanner: old.inPlanner !== false, days, updatedAt: Date.now() };
  };
  const weight = () => { const l = D().lists || {}; return +l.weight || +XD().watch.weightKg || 70; };
  const kcalOf = (met, mins) => Math.round(met * weight() * (mins / 60));
  const dayKcal = d => { const items = d.items || []; if (!items.length || !d.mins) return 0; const met = items.reduce((a, i) => a + ex(i.k || i.name).met, 0) / items.length; return kcalOf(met, d.mins); };

  /* ---------------- planner tasks: one repeating task per workout day ---------------- */
  let busy = false;
  XR.reconcile = () => {
    if (busy || !D() || !D().tasks || !D().exercise) return false;
    busy = true; let ch = false;
    try {
      const d = D(), x = XD(), p = XR.plan(), live = new Set(), today = U.today();
      if (p && p.inPlanner) {
        const role = ED.lifeRole ? ED.lifeRole(/health|fitness|exercise|gym|sport/i, 'Health & Fitness', '💪', '#16a34a', x) : null;
        [0, 1, 2, 3, 4, 5, 6].forEach(dw => {
          const day = p.days[dw]; if (!day || !day.items || !day.items.length || /^rest$/i.test(day.title || '')) return;
          const id = 'tk-exd-' + dw; live.add(id);
          const title = '💪 Workout: ' + day.title + (day.mins ? ' (' + day.mins + ' min)' : '');
          let t = d.tasks.find(y => y.id === id);
          const rep = { freq: 'weekly', days: [dw], interval: 1 };
          if (!t) {
            const start = U.addDays(today, (dw - U.dow(today) + 7) % 7);
            t = M.newTask({ id, title, date: start, time: p.time || null, dur: day.mins || 45, prio: 'A', repeat: rep, roleId: role, link: { k: 'exercise', id: String(dw) }, linkTitle: title,
              notes: day.items.map(i => '• ' + ex(i.k || i.name).name + ' — ' + i.sets + ' × ' + i.reps).join('\n') });
            d.tasks.push(t); ch = true; return;
          }
          if (t.repeat && t.repeat.until) { t.repeat = rep; ch = true; }
          if (t.linkTitle !== title) { if (t.title === t.linkTitle) t.title = title; t.linkTitle = title; ch = true; }
          if ((t.time || null) !== (p.time || null)) { t.time = p.time || null; ch = true; }
          if (t.dur !== (day.mins || 45)) { t.dur = day.mins || 45; ch = true; }
          const notes = day.items.map(i => '• ' + ex(i.k || i.name).name + ' — ' + i.sets + ' × ' + i.reps).join('\n');
          if (t.notes !== notes) { t.notes = notes; ch = true; }
        });
      }
      // a workout day taken out of the plan (or the plan out of the planner): it stops from today, ticked days stay
      const yday = U.addDays(today, -1);
      d.tasks.forEach(t => {
        if (!t.link || t.link.k !== 'exercise' || live.has(t.id)) return;
        if (t.repeat && !(t.repeat.until && t.repeat.until <= yday)) { if (t.date > yday) t.deleteMe = true; else t.repeat = Object.assign({}, t.repeat, { until: yday }); ch = true; }
      });
      if (d.tasks.some(t => t.deleteMe)) d.tasks = d.tasks.filter(t => !t.deleteMe);
    } catch (err) { console.warn('[e-diary] exercise', err); }
    finally { busy = false; }
    return ch;
  };
  ED.store.on((type, detail) => { if (type !== 'change' || (detail && detail.reason === 'exercise')) return; if (XR.reconcile()) ED.store.commit({ reason: 'exercise' }); });
  const open0 = A['task-open'];
  A['task-open'] = (el, ev) => {
    if (ev && ev.target && ev.target.closest && ev.target.closest('.tstat, .tmore')) return;
    const o = ED.tasksUI && ED.tasksUI.occFrom ? ED.tasksUI.occFrom(el) : null;
    if (o && o.t.link && o.t.link.k === 'exercise') { st().dw = +o.t.link.id; st().date = o.k; ED.go.tab('exercise'); return; }
    return open0 && open0(el, ev);
  };
  const del0 = M.deleteTask;
  M.deleteTask = id => { const t = M.task(id); if (t && t.link && t.link.k === 'exercise' && XR.plan()) { XR.plan().inPlanner = false; } return del0(id); };

  /* ---------------- watch / phone data ---------------- */
  const KIND = { CYCLING: 'Cycling', BIKING: 'Cycling', WALKING: 'Walk', WALK: 'Walk', RUNNING: 'Run', RUN: 'Run', JOGGING: 'Run', JOG: 'Run', TREADMILL: 'Run', EXERCISE: 'Workout', HIKING: 'Walk', SWIMMING: 'Swimming', YOGA: 'Yoga' };
  /* read a backup file: the cycling / steps app ("cycling-app-backup"), or a simple list of days or workouts */
  XR.importWatch = (data, fileName) => {
    const x = XD(); let days = 0, added = 0, updated = 0;
    const setDay = (k, n, km) => { if (!U.isKey(k) || !(n >= 0)) return; const o = x.steps[k]; if (!o || o.src === 'watch') { if (!o || o.n !== n) days++; x.steps[k] = { n: Math.round(n), km: km != null ? Math.round(km * 100) / 100 : (o && o.km) || null, src: 'watch' }; } };
    const addSession = s => {
      const ext = 'w-' + (s.ext || s.startTimeMs || (s.date + '-' + s.kind));
      const mins = Math.round((s.mins != null ? s.mins : ((s.movingMs || 0) > 60000 ? s.movingMs : s.elapsedMs || 0) / 60000) * 10) / 10;
      const km = s.km != null ? s.km : s.rawDistanceM != null ? (s.rawDistanceM * (s.factor || 1)) / 1000 : null;
      if (mins < 1 && !(km > 0.05) && !(s.kcal >= 1)) return;          // a session started by mistake
      const row = { date: s.date, kind: s.kind, title: s.kind + (km ? ' · ' + (Math.round(km * 10) / 10) + ' km' : ''), mins, kcal: s.kcal != null ? Math.round(s.kcal) : null, steps: s.steps || null, km: km != null ? Math.round(km * 100) / 100 : null, src: 'watch', ext, top: s.top || null, time: s.time || null };
      const old = x.log.find(y => y.ext === ext);
      if (old) { if (old.mins !== row.mins || old.kcal !== row.kcal || old.km !== row.km) { Object.assign(old, row, { updatedAt: Date.now() }); updated++; } }
      else { x.log.push(Object.assign({ id: 'xl-' + ext, updatedAt: Date.now() }, row)); added++; }
    };
    if (data && data.format === 'cycling-app-backup') {
      const s = data.settings || {};
      x.watch = Object.assign(x.watch, { file: fileName || x.watch.file || 'Cycling-backup.json', at: Date.now(), device: data.device || '', app: data.appVersion || '', goal: +s.dailyStepGoal || x.watch.goal || null, heightCm: +s.heightCm || null, weightKg: +s.weightKg || null, made: data.createdAtMs || null });
      (data.dailyActivity || []).forEach(a => setDay(a.day, +a.steps || 0, a.walkDistanceM != null ? a.walkDistanceM / 1000 : null));
      (data.sessions || []).filter(z => !z.isCalibration).forEach(z => {
        const t = new Date(z.startTimeMs || Date.now());
        addSession({ ext: z.startTimeMs, date: z.day || U.key(t), time: U.pad(t.getHours()) + ':' + U.pad(t.getMinutes()), kind: KIND[String(z.activityType || '').toUpperCase()] || 'Workout', movingMs: z.movingMs, elapsedMs: z.elapsedMs, rawDistanceM: z.rawDistanceM, factor: z.factor, kcal: z.kcal, steps: z.steps, top: z.topSpeedMps ? Math.round(z.topSpeedMps * 3.6 * 10) / 10 : null });
      });
      // the profile on Weekly meals starts from the app's height and weight
      const l = D().lists; if (l) { if (!l.height && s.heightCm) l.height = +s.heightCm; if (!l.weight && s.weightKg) l.weight = +s.weightKg; }
      if (!x.stepGoal && s.dailyStepGoal) x.stepGoal = +s.dailyStepGoal;
    } else {
      // a plain list: [{ date, steps, km, kcal, mins, kind }] or { days: […], workouts: […] }
      const rows = Array.isArray(data) ? data : (data && (data.days || data.daily || data.steps)) || [];
      rows.forEach(r => { const k = r.date || r.day; if (r.steps != null) setDay(k, +r.steps, r.km != null ? +r.km : null); });
      ((data && (data.workouts || data.sessions)) || []).forEach(r => addSession({ ext: r.id || r.start || (r.date + r.kind), date: r.date || r.day, kind: r.kind || r.type || 'Workout', mins: r.mins != null ? +r.mins : r.minutes != null ? +r.minutes : null, km: r.km != null ? +r.km : null, kcal: r.kcal != null ? +r.kcal : r.calories != null ? +r.calories : null }));
      x.watch.file = fileName || x.watch.file; x.watch.at = Date.now();
    }
    return { days, added, updated };
  };
  XR.pickFile = async () => {
    const f = await U.pickFile('.json,application/json'); if (!f) return;
    let data; try { data = JSON.parse(await U.readText(f)); } catch (err) { ED.ui.toast('That file is not a JSON backup'); return; }
    ED.store.checkpoint('Watch data');
    const r = XR.importWatch(data, f.name);
    ED.store.commit(); ED.ui.toast('Read ' + f.name + ': ' + U.plural(r.days, 'day') + ' of steps, ' + U.plural(r.added, 'new workout') + (r.updated ? ', ' + r.updated + ' updated' : ''));
  };
  /* from Google Drive: the newest file of that name (read-only access, asked for once) */
  let tok = null, tokExp = 0;
  const loadGIS = () => (window.google && google.accounts && google.accounts.oauth2) ? Promise.resolve() : (loadGIS.p = loadGIS.p || new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = res; s.onerror = () => { loadGIS.p = null; rej(new Error('Could not reach Google')); }; document.head.appendChild(s);
  }));
  const getToken = () => new Promise((resolve, reject) => {
    if (tok && Date.now() < tokExp - 60000) { resolve(tok); return; }
    const cid = ((D().settings.gcal && D().settings.gcal.clientId) || '').trim();
    if (!/\.apps\.googleusercontent\.com$/.test(cid)) { reject(new Error('Paste your OAuth Client ID in Settings → Google Calendar first (the same one Google Drive sync uses).')); return; }
    if (ED.env.file) { reject(new Error('Google sign-in needs the diary opened from its web address, not as a file.')); return; }
    loadGIS().then(() => {
      const tc = google.accounts.oauth2.initTokenClient({ client_id: cid, scope: 'https://www.googleapis.com/auth/drive.readonly', include_granted_scopes: true,
        callback: r => { if (r && r.access_token) { tok = r.access_token; tokExp = Date.now() + (+r.expires_in || 3600) * 1000; resolve(tok); } else reject(new Error((r && (r.error_description || r.error)) || 'Google did not give access')); },
        error_callback: er => reject(new Error(er && er.type === 'popup_failed_to_open' ? 'The browser blocked Google’s window — allow pop-ups for this address.' : 'Google sign-in was closed')) });
      tc.requestAccessToken({ prompt: '' });
    }, reject);
  });
  XR.fetchDrive = async quiet => {
    const x = XD(), name = (x.watch.driveName || 'Cycling-backup.json').trim();
    try {
      const t = await getToken();
      const q = encodeURIComponent("name = '" + name.replace(/'/g, "\\'") + "' and trashed = false");
      const r = await fetch('https://www.googleapis.com/drive/v3/files?q=' + q + '&orderBy=modifiedTime desc&pageSize=5&fields=files(id,name,modifiedTime)', { headers: { Authorization: 'Bearer ' + t } });
      if (r.status === 403) { const j = await r.json().catch(() => ({})); throw new Error(/has not been used|disabled/i.test(JSON.stringify(j)) ? 'Turn on the Google Drive API for your Client ID’s project (Google Cloud Console).' : 'Google refused: ' + ((j.error && j.error.message) || r.status)); }
      if (!r.ok) throw new Error('Google Drive: ' + r.status);
      const files = (await r.json()).files || [];
      if (!files.length) throw new Error('No file called “' + name + '” in your Google Drive. Make a backup in the phone app first (or change the file name).');
      const f = files[0];
      const c = await fetch('https://www.googleapis.com/drive/v3/files/' + f.id + '?alt=media', { headers: { Authorization: 'Bearer ' + t } });
      if (!c.ok) throw new Error('Could not read ' + f.name + ' (' + c.status + ')');
      const data = await c.json();
      ED.store.checkpoint('Watch data');
      const res = XR.importWatch(data, f.name);
      XD().watch.modified = f.modifiedTime; XD().watch.fileId = f.id;
      ED.store.commit();
      if (!quiet) ED.ui.toast('From Google Drive (' + f.name + ', saved ' + U.fmtStamp(Date.parse(f.modifiedTime)) + '): ' + U.plural(res.days, 'day') + ' of steps, ' + U.plural(res.added, 'new workout'));
      return res;
    } catch (err) {
      if (!quiet) ED.ui.toast(err.message || String(err), { timeout: 9000 });
      throw err;
    }
  };

  /* ---------------- figures ---------------- */
  const goal = () => +XD().stepGoal || +XD().watch.goal || 8000;
  XR.stepsOn = k => { const s = XD().steps[k]; return s ? s.n : 0; };
  XR.burnOn = k => {           // calories burned in workouts that day (watch kcal, or worked out from minutes)
    return XD().log.filter(r => r.date === k).reduce((a, r) => a + (r.kcal != null && r.kcal > 0 ? r.kcal : kcalOf(({ Walk: 4.3, Run: 8, Cycling: 7, Yoga: 3, HIIT: 8, Swimming: 7, Strength: 5, Workout: 5, Sport: 7 })[r.kind] || 5, r.mins || 0)), 0)
      + Math.round(0.5 * weight() * XR.walkKm(k));                         // walking: about 0.5 kcal per kg per km (as the phone app)
  };
  XR.week = k => U.range(U.addDays(k, -6), 7);
  /* walking distance that day: from the phone, or steps × your step length (0.7 m) */
  XR.walkKm = k => { const s = XD().steps[k]; if (!s) return 0; return s.km != null && s.km > 0 ? +s.km : (s.n || 0) * 0.0007; };
  const KM = { Walk: 'walk', Cycling: 'cycle', Run: 'run' };
  /* distance by kind on a day: walking from the daily steps, cycling and running from the sessions */
  XR.kmOn = k => {
    const o = { walk: XR.walkKm(k), cycle: 0, run: 0 };
    XD().log.forEach(r => { if (r.date !== k || !(+r.km > 0)) return; const t = KM[r.kind]; if (t && t !== 'walk') o[t] += +r.km; });
    return o;
  };
  const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
  const hasDay = k => !!XD().steps[k] || XD().log.some(r => r.date === k);

  /* ---------------- left page: the plan ---------------- */
  const tplPicker = cur => '<div class="xr-tpls">' + Object.keys(TPL).map(k => '<button type="button" class="xr-tpl' + (cur === k ? ' sel' : '') + '" data-act="xr-tpl" data-k="' + k + '"><b>' + e(TPL[k].name) + '</b></button>').join('') + '</div>';
  const left = () => {
    const p = XR.plan(), s = st(), today = U.today();
    if (!p) {
      return FX().page('xr', 'Exercise plan', '', '<p class="xr-intro">Choose a plan for your goal. You can change every day and every exercise afterwards, and each workout day goes into the Daily planner under <b>Health &amp; Fitness</b>.</p>' + tplPicker('') + guideHtml(), 'xr-l');
    }
    const dw = s.dw != null ? s.dw : U.dow(today);
    const order = [1, 2, 3, 4, 5, 6, 0];
    const strip = '<div class="xr-week">' + order.map(d => { const x = p.days[d] || { title: 'Rest', items: [] }; const rest = !x.items || !x.items.length; return '<button type="button" class="xr-wd' + (d === dw ? ' sel' : '') + (d === U.dow(today) ? ' today' : '') + (rest ? ' rest' : '') + '" data-act="xr-dw" data-d="' + d + '"><b>' + U.DAY3[d] + '</b><span>' + e(x.title || 'Rest') + '</span>' + (x.mins ? '<i class="num">' + x.mins + ' min</i>' : '') + '</button>'; }).join('') + '</div>';
    const day = p.days[dw] || { title: 'Rest', items: [], mins: 0 };
    const k = s.date && U.dow(s.date) === dw ? s.date : U.addDays(today, (dw - U.dow(today) + 7) % 7 - (dw === U.dow(today) ? 0 : 0));
    const ticks = XD().ticks[k] || {};
    const items = (day.items || []).map((i, n) => {
      const x = ex(i.k || i.name), open = s.how === n;
      return '<li class="xr-it' + (ticks[n] ? ' done' : '') + '"><button type="button" class="hz-tick' + (ticks[n] ? ' on' : '') + '" data-act="xr-tick" data-k="' + k + '" data-i="' + n + '" aria-pressed="' + !!ticks[n] + '" aria-label="Done">' + (ticks[n] ? ED.icon('check') : '') + '</button>' +
        '<button type="button" class="plain-btn grow xr-in" data-act="xr-how" data-i="' + n + '"><b>' + e(x.name) + '</b><span class="hint">' + e(i.sets + ' × ' + i.reps) + (x.equip && x.equip !== 'none' ? ' · ' + e(x.equip) : '') + ' · <span class="xr-area a-' + e(x.area) + '">' + e(x.area) + '</span></span>' + (open && x.how ? '<span class="xr-how">' + e(x.how) + '</span>' : '') + '</button>' +
        '<button type="button" class="icon-btn sm" data-act="xr-edit-item" data-d="' + dw + '" data-i="' + n + '" aria-label="Change" title="Change">' + ED.icon('pencil') + '</button></li>';
    }).join('');
    const doneN = Object.keys(ticks).length, kc = dayKcal(day);
    const logged = XD().log.some(r => r.date === k && r.planDay === dw);
    const body = '<div class="xr-top"><span class="hint">' + e(p.name) + '</span><button type="button" class="link-btn" data-act="xr-change">Change plan</button></div>' + strip +
      '<div class="xr-day"><div class="xr-dh"><div><h3 class="xr-dt">' + e(U.DAYS[dw]) + ' · ' + e(day.title || 'Rest') + '</h3><span class="hint">' + (day.mins ? day.mins + ' min · about ' + kc + ' kcal' : 'Rest day') + (day.items && day.items.length ? ' · ' + doneN + '/' + day.items.length + ' done' + (k !== today ? ' (' + e(U.fmtDM(k)) + ')' : '') : '') + '</span></div>' +
      '<button type="button" class="icon-btn sm" data-act="xr-edit-day" data-d="' + dw + '" title="Rename the day / minutes">' + ED.icon('pencil') + '</button></div>' +
      (items ? '<ul class="xr-items">' + items + '</ul>' : '<p class="hint">Rest and recover — an easy walk or stretching is fine.</p>') +
      '<div class="row-btns"><button type="button" class="btn small" data-act="xr-add-item" data-d="' + dw + '">' + ED.icon('plus') + 'Add an exercise</button>' +
      (day.items && day.items.length ? '<button type="button" class="btn small primary" data-act="xr-log-day" data-d="' + dw + '" data-k="' + k + '"' + (logged ? ' disabled' : '') + '>' + ED.icon('check') + (logged ? 'Logged' : 'Log this workout') + '</button>' : '') + '</div></div>' +
      '<div class="xr-pl"><label class="switch"><input type="checkbox" data-change="xr-inplan"' + (p.inPlanner ? ' checked' : '') + '><span class="track"></span><span>Put the workouts in the Daily planner at</span></label> <input type="time" class="field xr-time" data-change="xr-time" value="' + e(p.time || '') + '" aria-label="Workout time"></div>' +
      (TPL[p.tpl] ? '<p class="hint xr-note">' + e(TPL[p.tpl].note) + '</p>' : '') +
      guideHtml();
    return FX().page('xr', 'Exercise plan', '', body, 'xr-l');
  };
  const guideHtml = () => {
    const s = st();
    return '<h3 class="gh fin-gap">Which exercises for…</h3><div class="xr-guide">' + GUIDE.map((g, i) => '<details' + (s.guide === i ? ' open' : '') + '><summary data-act="xr-guide" data-i="' + i + '">' + e(g[0]) + '</summary><p>' + e(g[2]) + '</p><ul class="xr-glist">' +
      g[3].map(k => '<li><b>' + e(LIB[k][0]) + '</b> — <span class="hint">' + e(LIB[k][5]) + '</span></li>').join('') + '</ul></details>').join('') + '</div>' +
      '<p class="hint">A general guide, not medical advice. Warm up 5–10 minutes first; stop if you feel chest pain, dizziness or joint pain, and check with a doctor before starting if you have heart, BP, diabetes or joint problems.</p>';
  };

  /* ---------------- analysis: distance by kind, weeks, rides ---------------- */
  const analysis = days => {
    const x = XD(), today = U.today();
    const chart = ED.charts.groups({ title: 'Distance, last 14 days (km)', h: 170, left: 40, maxLabels: 7,
      series: [{ name: 'Walking', color: 'var(--s3)' }, { name: 'Cycling', color: 'var(--s2)' }, { name: 'Running', color: 'var(--s6)' }],
      legend: ED.charts.legend([{ kind: 'g', label: 'Walking', color: 'var(--s3)' }, { kind: 'g', label: 'Cycling', color: 'var(--s2)' }, { kind: 'g', label: 'Running', color: 'var(--s6)' }]),
      data: days.map(k => { const o = XR.kmOn(k); return { label: String(+k.slice(8)), long: U.fmtLong(k), values: [r2(o.walk), r2(o.cycle), r2(o.run)], tip: 'walk ' + r2(o.walk) + ' · cycle ' + r2(o.cycle) + ' · run ' + r2(o.run) + ' km' }; }),
      fmt: v => String(Math.round(v * 10) / 10) });
    // weeks (Monday to Sunday), the last six
    const wk0 = U.startOfWeek(today, 1), weeks = [0, 1, 2, 3, 4, 5].map(i => U.addDays(wk0, -7 * i));
    const wrow = a => { const ds = U.range(a, 7).filter(k => k <= today); let st = 0, n = 0, wk = 0, cy = 0, rn = 0, kc = 0, mn = 0, hit = 0;
      ds.forEach(k => { if (x.steps[k]) { n++; st += XR.stepsOn(k); if (XR.stepsOn(k) >= goal()) hit++; } const o = XR.kmOn(k); wk += o.walk; cy += o.cycle; rn += o.run; kc += XR.burnOn(k); });
      x.log.forEach(r => { if (ds.indexOf(r.date) >= 0) mn += +r.mins || 0; });
      return { a, st, n, wk, cy, rn, kc, mn, hit }; };
    const wr = weeks.map(wrow).filter(r => r.n || r.cy || r.rn || r.mn);
    const table = wr.length ? '<div class="ml-tablewrap"><table class="mm-table xr-wtab"><thead><tr><th>Week of</th><th>Steps / day</th><th>Goal met</th><th>Walk km</th><th>Cycle km</th><th>Run km</th><th>Active min</th><th>kcal</th></tr></thead><tbody>' +
      wr.map(r => '<tr><th class="num">' + e(U.fmtDM(r.a)) + '</th><td class="num">' + (r.n ? Math.round(r.st / r.n).toLocaleString('en-IN') : '—') + '</td><td class="num">' + r.hit + '/' + r.n + '</td><td class="num">' + r1(r.wk) + '</td><td class="num">' + r1(r.cy) + '</td><td class="num">' + r1(r.rn) + '</td><td class="num">' + Math.round(r.mn) + '</td><td class="num">' + Math.round(r.kc).toLocaleString('en-IN') + '</td></tr>').join('') + '</tbody></table></div>' : '';
    // rides and runs
    const rides = x.log.filter(r => (r.kind === 'Cycling' || r.kind === 'Run' || r.kind === 'Walk') && +r.km > 0).sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || ''))).slice(0, 12);
    const rideTab = rides.length ? '<div class="ml-tablewrap"><table class="mm-table xr-rtab"><thead><tr><th>Date</th><th>Activity</th><th>km</th><th>Time</th><th>Avg km/h</th><th>Top km/h</th><th>kcal</th></tr></thead><tbody>' +
      rides.map(r => '<tr><th class="num">' + e(U.fmtDM(r.date)) + (r.time ? ' <span class="hint">' + e(FX().time(r.time)) + '</span>' : '') + '</th><td>' + e(r.kind) + '</td><td class="num">' + r2(+r.km) + '</td><td class="num">' + Math.round(r.mins || 0) + ' min</td><td class="num">' + (r.mins ? r1(r.km / (r.mins / 60)) : '—') + '</td><td class="num">' + (r.top || '—') + '</td><td class="num">' + (r.kcal != null ? Math.round(r.kcal) : '—') + '</td></tr>').join('') + '</tbody></table></div>' : '<p class="hint">No rides or runs with distance yet.</p>';
    const tot = x.log.filter(r => r.kind === 'Cycling' && +r.km > 0), totKm = tot.reduce((a, r) => a + +r.km, 0);
    return '<h3 class="gh fin-gap">Analysis</h3>' + chart +
      (wr.length ? '<h4 class="ls-gh">Week by week</h4>' + table : '') +
      '<h4 class="ls-gh">Rides, runs and walks <span class="hint">· ' + U.plural(tot.length, 'ride') + ', ' + r1(totKm) + ' km cycled in all</span></h4>' + rideTab;
  };
  /* read the phone file again by itself when the page opens, if Google has already given access this session */
  const autoRead = () => { const w = XD().watch; if (tok && Date.now() < tokExp - 60000 && (!w.at || Date.now() - w.at > 15 * 60e3)) XR.fetchDrive(true).catch(() => {}); };

  /* ---------------- right page: activity ---------------- */
  const right = () => {
    const x = XD(), today = U.today(), g = goal();
    const days = U.range(U.addDays(today, -13), 14);
    const stepsT = XR.stepsOn(today), wk = XR.week(today);
    const wkDays = wk.filter(k => x.steps[k]), wkSteps = wkDays.reduce((a, k) => a + XR.stepsOn(k), 0), wkLog = x.log.filter(r => wk.indexOf(r.date) >= 0);
    const kmT = XR.kmOn(today), km7 = wk.reduce((a, k) => { const o = XR.kmOn(k); a.walk += o.walk; a.cycle += o.cycle; a.run += o.run; return a; }, { walk: 0, cycle: 0, run: 0 });
    const wkMin = Math.round(wkLog.reduce((a, r) => a + (+r.mins || 0), 0)), wkKcal = wk.reduce((a, k) => a + XR.burnOn(k), 0);
    const tiles = '<div class="tiles xp-tiles">' + FX().tile('Steps today', stepsT.toLocaleString('en-IN'), 'goal ' + g.toLocaleString('en-IN') + (stepsT >= g ? ' — met ✓' : ' · ' + Math.max(0, g - stepsT).toLocaleString('en-IN') + ' to go') + ' · walking ' + r2(kmT.walk) + ' km') +
      FX().tile('Last 7 days', wkDays.length ? Math.round(wkSteps / wkDays.length).toLocaleString('en-IN') : '—', wkDays.length ? 'steps a day on average (' + U.plural(wkDays.length, 'day') + ' with data)' : 'no steps yet') +
      FX().tile('Cycling', r1(km7.cycle) + ' km', 'last 7 days · today ' + r1(kmT.cycle) + ' km') +
      FX().tile('Walking · running', r1(km7.walk) + ' · ' + r1(km7.run) + ' km', 'last 7 days') +
      FX().tile('Active minutes', String(wkMin), 'in workouts, last 7 days (aim 150+)', wkMin < 150 ? 'warn' : '') +
      FX().tile('Calories burned', wkKcal.toLocaleString('en-IN'), 'kcal from steps and workouts, 7 days') + '</div>';
    const chart = ED.charts.columns({ title: 'Steps, last 14 days', h: 160, left: 44, maxLabels: 7, color: 'var(--s3)',
      data: days.map(k => ({ label: String(+k.slice(8)), long: U.fmtLong(k), value: XR.stepsOn(k), total: g, tip: XR.stepsOn(k).toLocaleString('en-IN') + ' steps' + ((x.steps[k] || {}).km ? ' · ' + x.steps[k].km + ' km' : '') + ' (goal ' + g.toLocaleString('en-IN') + ')' })),
      cur: 13, sub: 'Bars: steps that day. Pale bar: your daily goal.',
      table: ED.charts.table(['Day', 'Steps', 'km', 'Burned (kcal)'], days.slice().reverse().map(k => [U.fmtDM(k), XR.stepsOn(k).toLocaleString('en-IN'), String((x.steps[k] || {}).km || ''), String(XR.burnOn(k))])) });
    const w = x.watch;
    const made = +w.made || (w.modified ? Date.parse(w.modified) : 0);
    const stale = made && Date.now() - made > 2 * 3600e3;
    const fresh = made ? '<div class="notice ' + (stale ? 'warn' : 'info') + ' xr-fresh">' + ED.icon(stale ? 'info' : 'cloudCheck') + '<span class="grow">The phone app’s backup in Google Drive was saved <b>' + e(U.fmtStamp(made)) + '</b>' +
      (stale ? '. Steps, walks and rides after that are not in it, so the diary shows less than the app. In the phone app, make a new backup to Google Drive (Settings → Backup), then click <b>Read from Google Drive</b> here.' : ' — up to date.') + '</span></div>' : '';
    const watchBox = '<div class="xr-watch"><div class="xr-wh">' + ED.icon('cloud') + '<b>Phone / watch data</b><span class="hint">' + (w.at ? 'last read ' + e(U.fmtStamp(w.at)) + (w.file ? ' from ' + e(w.file) : '') + (w.device ? ' · ' + e(w.device) : '') : 'not read yet') + '</span></div>' + fresh +
      '<div class="row-btns"><button type="button" class="btn small primary" data-act="xr-drive">' + ED.icon('cloud') + 'Read from Google Drive</button><button type="button" class="btn small" data-act="xr-file">' + ED.icon('upload') + 'Choose the backup file…</button><button type="button" class="btn small ghost" data-act="xr-wset">' + ED.icon('gear') + '</button></div>' +
      '<p class="hint">Reads the newest <b>' + e(w.driveName || 'Cycling-backup.json') + '</b> that the phone app saves to Google Drive: steps per day, cycling and exercise sessions with distance and calories, your height, weight and step goal. Days you typed in yourself are kept.</p></div>';
    const log = x.log.slice().sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || ''))).slice(0, 30);
    const logHtml = log.length ? '<ul class="xp-list xr-log">' + log.map(r => '<li><button type="button" class="plain-btn xp-li" data-act="xr-log" data-id="' + e(r.id) + '"><span class="num">' + e(U.fmtDM(r.date)) + '</span><span class="grow"><b>' + e(r.title || r.kind) + '</b><span class="hint"> ' + e([r.mins ? Math.round(r.mins) + ' min' : '', r.km ? r.km + ' km' : '', r.kcal ? r.kcal + ' kcal' : '', r.top ? 'top ' + r.top + ' km/h' : ''].filter(Boolean).join(' · ')) + '</span></span><span class="chip xr-src ' + (r.src === 'watch' ? 'w' : 'm') + '">' + (r.src === 'watch' ? '⌚ phone' : '✍ added') + '</span></button></li>').join('') + '</ul>' : '<p class="hint">No workouts yet. Log one by hand or read the phone app’s backup.</p>';
    const body = tiles + chart + watchBox + analysis(days) +
      '<h3 class="gh fin-gap">Workouts <span class="hint">· from the phone and added by hand</span></h3>' +
      '<div class="row-btns"><button type="button" class="btn small" data-act="xr-log">' + ED.icon('plus') + 'Log a workout</button><button type="button" class="btn small" data-act="xr-steps">' + ED.icon('plus') + 'Add steps for a day</button>' +
      '<label class="xr-goal">Step goal <input type="number" class="field num" min="1000" max="40000" step="500" value="' + g + '" data-change="xr-goal" aria-label="Daily step goal"></label></div>' + logHtml;
    return '<div class="xp xr-r"><div class="pg-head st-head"><h2 class="pg-title">Activity &amp; watch</h2></div><div class="st-scroll scroll" data-keep-scroll="xr-r">' + body + '</div></div>';
  };

  ED.views = ED.views || {};
  ED.views.exercise = { id: 'exercise', label: 'Exercise', left, right, mount(L, R) { ED.charts.bind(R); setTimeout(autoRead, 50); } };

  /* ---------------- editors ---------------- */
  const libOptions = () => {
    const by = {}; Object.keys(LIB).forEach(k => { (by[LIB[k][1]] = by[LIB[k][1]] || []).push([k, LIB[k][0] + (LIB[k][3] !== 'none' ? ' (' + LIB[k][3] + ')' : '')]); });
    return Object.keys(by).flatMap(a => by[a].map(o => [o[0], a + ' — ' + o[1]]));
  };
  const editItem = (dw, n) => {
    const p = XR.plan(); if (!p) return;
    const day = p.days[dw] || (p.days[dw] = { title: 'Workout', focus: '', mins: 30, items: [] });
    const it = n != null ? day.items[n] : null;
    FX().form({
      title: it ? 'Exercise' : 'Add an exercise · ' + U.DAYS[dw],
      data: it ? { k: it.k || '', name: it.k ? '' : it.name, sets: it.sets, reps: it.reps } : { k: 'pushup', name: '', sets: 3, reps: '10–12' },
      fields: [{ k: 'k', label: 'Exercise', type: 'select', options: [['', '— my own (type below) —']].concat(libOptions()) }, { k: 'name', label: 'Or my own exercise', ph: 'e.g. Badminton 30 min' }, { k: 'sets', label: 'Sets', type: 'number', min: 1, max: 20 }, { k: 'reps', label: 'Reps / time', ph: '10–12, 30 s, 20 min' }],
      check: v => !v.k && !v.name ? 'Choose an exercise or type one' : '',
      del: it ? async () => { ED.store.checkpoint('Exercise'); day.items.splice(n, 1); p.updatedAt = Date.now(); ED.store.commit(); } : null, delLabel: 'Remove',
      save(v, api) { ED.store.checkpoint('Exercise'); const row = v.k ? { k: v.k, sets: v.sets || 1, reps: v.reps || '' } : { name: v.name, sets: v.sets || 1, reps: v.reps || '' }; if (it) day.items[n] = row; else day.items.push(row); p.updatedAt = Date.now(); ED.store.commit(); api.close(); },
    });
  };
  const editDay = dw => {
    const p = XR.plan(); if (!p) return;
    const day = p.days[dw] || (p.days[dw] = { title: 'Rest', focus: '', mins: 0, items: [] });
    FX().form({ title: U.DAYS[dw], data: { title: day.title, mins: day.mins },
      fields: [{ k: 'title', label: 'Workout', req: true, ph: 'Chest + HIIT, Legs, Rest…' }, { k: 'mins', label: 'Minutes', type: 'number', min: 0, max: 300 }],
      extra: day.items && day.items.length ? '<p class="hint">To make it a rest day, remove its exercises.</p>' : '',
      save(v, api) { ED.store.checkpoint('Workout day'); day.title = v.title; day.mins = +v.mins || 0; p.updatedAt = Date.now(); ED.store.commit(); api.close(); } });
  };
  XR.editLog = (id, preset) => {
    const x = XD(), r = id ? x.log.find(y => y.id === id) : null;
    const KINDS = ['Strength', 'Walk', 'Run', 'Cycling', 'Yoga', 'HIIT', 'Swimming', 'Sport', 'Workout', 'Other'];
    FX().form({ title: r ? (r.src === 'watch' ? 'Workout from the phone' : 'Workout') : 'Log a workout',
      data: r ? Object.assign({}, r) : Object.assign({ date: U.today(), kind: 'Walk', title: '', mins: 30, kcal: null, km: null, steps: null, notes: '' }, preset || {}),
      fields: [{ k: 'date', label: 'Date', type: 'date', req: true }, { k: 'time', label: 'Time', type: 'time' }, { k: 'kind', label: 'Kind', type: 'select', options: KINDS.map(k => [k, k]) }, { k: 'title', label: 'What', ph: 'Chest day, morning walk, badminton…' },
        { k: 'mins', label: 'Minutes', type: 'number', min: 0, step: 1 }, { k: 'km', label: 'Distance (km)', type: 'number', min: 0, step: 0.1 }, { k: 'kcal', label: 'Calories (kcal)', type: 'number', min: 0, hint: 'Leave empty to work it out from the minutes and your weight.' }, { k: 'notes', label: 'Notes', type: 'textarea', rows: 2 }],
      del: r ? async () => { ED.store.checkpoint('Workout'); x.log = x.log.filter(y => y !== r); ED.store.commit(); ED.ui.undoToast('Workout removed' + (r.src === 'watch' ? ' (it comes back if you read the same backup again)' : '')); } : null,
      save(v, api) { ED.store.checkpoint('Workout'); if (!v.title) v.title = v.kind; if (r) Object.assign(r, v, { updatedAt: Date.now() }); else x.log.push(Object.assign({ id: U.uid('xl'), src: 'manual', updatedAt: Date.now() }, preset && preset.planDay != null ? { planDay: preset.planDay } : {}, v)); ED.store.commit(); api.close(); ED.ui.toast('Workout saved'); } });
  };

  /* ---------------- actions ---------------- */
  A['xr-tpl'] = async el => {
    const k = el.dataset.k, p = XR.plan();
    if (p && !await ED.ui.confirm({ title: 'Use this plan', message: 'Replace your plan with “' + TPL[k].name + '”? Your logged workouts and steps stay.', ok: 'Use it' })) return;
    ED.store.checkpoint('Exercise plan'); useTpl(k); st().dw = U.dow(U.today()); st().pick = false; ED.store.commit(); ED.ui.undoToast('Plan set — the workout days are in the Daily planner');
  };
  A['xr-change'] = el => ED.ui.menu(el, Object.keys(TPL).map(k => ({ label: TPL[k].name, icon: 'list', onClick: () => A['xr-tpl']({ dataset: { k } }) })));
  A['xr-dw'] = el => { st().dw = +el.dataset.d; st().date = null; st().how = null; ED.app.render(); };
  A['xr-how'] = el => { const s = st(); s.how = s.how === +el.dataset.i ? null : +el.dataset.i; ED.app.render(); };
  A['xr-tick'] = el => { const t = XD().ticks, k = el.dataset.k, i = el.dataset.i; const m = t[k] || (t[k] = {}); if (m[i]) delete m[i]; else m[i] = 1; if (!Object.keys(m).length) delete t[k]; ED.store.commit(); };
  A['xr-edit-item'] = el => editItem(+el.dataset.d, +el.dataset.i);
  A['xr-add-item'] = el => editItem(+el.dataset.d, null);
  A['xr-edit-day'] = el => editDay(+el.dataset.d);
  A['xr-log-day'] = el => { const p = XR.plan(), dw = +el.dataset.d, day = p.days[dw]; XR.editLog(null, { date: el.dataset.k, kind: /cardio|walk|cycl/i.test(day.title) ? 'Walk' : 'Strength', title: day.title, mins: day.mins, kcal: dayKcal(day), planDay: dw }); };
  A['xr-guide'] = el => { const s = st(); s.guide = s.guide === +el.dataset.i ? null : +el.dataset.i; };
  A['xr-log'] = el => XR.editLog(el.dataset.id || null);
  A['xr-steps'] = () => {
    const x = XD();
    FX().form({ title: 'Steps for a day', data: { date: U.today(), n: null, km: null }, fields: [{ k: 'date', label: 'Date', type: 'date', req: true }, { k: 'n', label: 'Steps', type: 'number', min: 0, req: true }, { k: 'km', label: 'Distance (km)', type: 'number', min: 0, step: 0.1 }],
      save(v, api) { ED.store.checkpoint('Steps'); x.steps[v.date] = { n: Math.round(+v.n || 0), km: v.km, src: 'manual' }; ED.store.commit(); api.close(); ED.ui.toast('Steps saved'); } });
  };
  A['xr-file'] = () => XR.pickFile();
  A['xr-drive'] = () => XR.fetchDrive(false).catch(() => {});
  A['xr-wset'] = () => {
    const x = XD();
    FX().form({ title: 'Phone / watch data', data: { driveName: x.watch.driveName || 'Cycling-backup.json' }, fields: [{ k: 'driveName', label: 'File name in Google Drive', hint: 'The backup file the phone app saves. The newest file of this name is read.' }],
      extra: '<p class="hint">Reading from Google Drive asks Google once for read-only access to your Drive (“See and download all your Google Drive files”), because the phone app made that file, not the diary. The diary only reads that one file. Uses the OAuth Client ID from Settings → Google Calendar; the diary must be open from its web address.</p>',
      save(v, api) { x.watch.driveName = v.driveName || 'Cycling-backup.json'; ED.store.commit(); api.close(); } });
  };
  CH['xr-inplan'] = el => { const p = XR.plan(); if (!p) return; ED.store.checkpoint('Exercise plan'); p.inPlanner = el.checked; ED.store.commit(); ED.ui.toast(el.checked ? 'Workouts are in the Daily planner' : 'Workouts taken out of the planner (from today)'); };
  CH['xr-time'] = el => { const p = XR.plan(); if (!p) return; p.time = el.value || null; ED.store.commit(); };
  CH['xr-goal'] = el => { XD().stepGoal = Math.max(1000, +el.value || 8000); ED.store.commit(); };
})();
