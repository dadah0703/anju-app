/*******************************************************
 * DB 파일 경로 (폴더 구조 기준: anju-app/data)
 *******************************************************/
const DB = {
  questions: "./data/anju_question_list.xlsx",
  types: "./data/anju_type_profiles.xlsx",
  dishes: "./data/anju_db_extended.xlsx",
  images: "./data/image_mapping_template.xlsx"
};

const IMG_BASE = "./images/";

/*******************************************************
 * 전역 상태
 *******************************************************/
let QUESTIONS = [];
let TYPE_PROFILES = [];
let DISHES = [];
let IMAGE_MAP = {};

let currentIndex = 0;
let answers = {};

/*******************************************************
 * DOM
 *******************************************************/
const $ = (id) => document.getElementById(id);

const elLoading = $("loading");
const elLanding = $("landing");
const elProgressWrap = $("progress-wrap");
const elQuestionCard = $("question-card");
const elResultCard = $("result-card");
const elError = $("error");
const elErrorMsg = $("error-msg");

const btnStart = $("btn-start");
const btnPrev = $("btn-prev");
const btnNext = $("btn-next");
const btnRestart = $("btn-restart");
const btnAgain = $("btn-again");

const elProgressStep = $("progress-step");
const elProgressSub = $("progress-sub");
const elProgressFill = $("progress-fill");

const elQPart = $("q-part");
const elQNo = $("q-no");
const elQTitle = $("q-title");
const elQImage = $("q-image");
const elOptions = $("options");

const elParticipants = $("participants");
const elShareToast = $("share-toast");

/*******************************************************
 * XLSX 로더
 *******************************************************/
async function loadXlsxFirstSheetToJson(url, sheetName = null) {
  const ab = await fetch(url).then(r => {
    if (!r.ok) throw new Error(`엑셀 파일 로드 실패: ${url}`);
    return r.arrayBuffer();
  });
  const wb = XLSX.read(ab, { type: "array" });
  const targetSheetName = sheetName ?? wb.SheetNames[0];
  const ws = wb.Sheets[targetSheetName];
  if (!ws) throw new Error(`시트를 찾을 수 없음: ${targetSheetName} in ${url}`);
  return XLSX.utils.sheet_to_json(ws, { defval: "" });
}

/*******************************************************
 * B. initDB()
 *******************************************************/
async function initDB() {
  QUESTIONS = await loadXlsxFirstSheetToJson(DB.questions);
  TYPE_PROFILES = await loadXlsxFirstSheetToJson(DB.types);
  DISHES = await loadXlsxFirstSheetToJson(DB.dishes);
  const imageRows = await loadXlsxFirstSheetToJson(DB.images);

  IMAGE_MAP = {};
  for (const r of imageRows) {
    const key = String(r.item_name || "").trim();
    if (!key) continue;
    IMAGE_MAP[key] = String(r.image_filename || "").trim();
  }

  QUESTIONS.sort((a, b) => Number(a.q_no) - Number(b.q_no));
  TYPE_PROFILES.sort((a, b) => Number(a.type_no) - Number(b.type_no));

  console.log("DB 로드 완료", {
    questions: QUESTIONS.length,
    types: TYPE_PROFILES.length,
    dishes: DISHES.length,
    imageMap: Object.keys(IMAGE_MAP).length
  });
}

/*******************************************************
 * 화면 전환 유틸
 *******************************************************/
function showOnly(sectionId) {
  // 섹션들 모두 숨김
  elLoading.classList.add("hidden");
  elLanding.classList.add("hidden");
  elProgressWrap.classList.add("hidden");
  elQuestionCard.classList.add("hidden");
  elResultCard.classList.add("hidden");
  elError.classList.add("hidden");

  // 원하는 것만 표시
  $(sectionId)?.classList.remove("hidden");
}

/*******************************************************
 * 질문 렌더
 *******************************************************/
function renderQuestion(idx) {
  const q = QUESTIONS[idx];
  if (!q) return;

  const total = QUESTIONS.length;
  const step = idx + 1;
  const percent = Math.round((step / total) * 100);

  elProgressStep.textContent = `STEP ${step}`;
  elProgressSub.textContent = `총 ${total}문항`;
  elProgressFill.style.width = `${percent}%`;

  elQPart.textContent = String(q.part || "파트");
  elQNo.textContent = `Q${q.q_no}`;
  elQTitle.textContent = String(q.question || "");

  const imgFile = IMAGE_MAP[String(q.question || "").trim()];
  elQImage.src = imgFile ? `${IMG_BASE}${imgFile}` : "";
  elQImage.style.display = imgFile ? "block" : "none";

  elOptions.innerHTML = "";
  const opts = [q.option_1, q.option_2, q.option_3, q.option_4]
    .filter(v => String(v).trim() !== "" && String(v).toLowerCase() !== "nan");

  const saved = answers[q.q_no];

  opts.forEach((optText) => {
    const t = String(optText).trim();

    const div = document.createElement("div");
    div.className = "option";
    div.dataset.value = t;

    const radio = document.createElement("div");
    radio.className = "radio";

    const textWrap = document.createElement("div");
    const title = document.createElement("div");
    title.className = "text";
    title.textContent = t;

    textWrap.appendChild(title);
    div.appendChild(radio);
    div.appendChild(textWrap);

    if (saved && saved === t) div.classList.add("selected");

    div.addEventListener("click", () => {
      answers[q.q_no] = t;
      [...elOptions.querySelectorAll(".option")].forEach(x => x.classList.remove("selected"));
      div.classList.add("selected");
      btnNext.disabled = false;
      btnNext.textContent = (idx === QUESTIONS.length - 1) ? "결과 보기" : "다음";
    });

    elOptions.appendChild(div);
  });

  btnPrev.disabled = idx === 0;
  btnNext.textContent = (idx === QUESTIONS.length - 1) ? "결과 보기" : "다음";
  btnNext.disabled = !answers[q.q_no];
}

/*******************************************************
 * C. pickTypeNoByAnswers()
 *******************************************************/
function pickTypeNoByAnswers() {
  const weather = answers[1] || "";
  const mood = answers[2] || "";
  const drink = answers[5] || "";
  const flavor = answers[11] || "";
  const cook = answers[12] || "";

  const tokens = [];
  if (drink.includes("소주")) tokens.push("소주");
  if (drink.includes("맥주")) tokens.push("맥주");
  if (drink.includes("막걸리")) tokens.push("막걸리");
  if (drink.includes("와인") || drink.includes("칵테일")) tokens.push("와인");

  if (mood.includes("스트레스")) tokens.push("스트레스");
  if (mood.includes("행복")) tokens.push("행복");
  if (mood.includes("차분")) tokens.push("차분");
  if (mood.includes("헛헛") || mood.includes("아쉽")) tokens.push("감성");

  if (weather.includes("비") || weather.includes("눈")) tokens.push("비");
  if (weather.includes("흐리")) tokens.push("흐림");
  if (weather.includes("화창")) tokens.push("화창");
  if (weather.includes("춥") || weather.includes("더움")) tokens.push("추위");

  if (flavor.includes("매콤") || flavor.includes("얼큰")) tokens.push("매콤", "얼큰");
  if (flavor.includes("달콤") || flavor.includes("짭짤")) tokens.push("달콤", "짭짤");
  if (flavor.includes("시원") || flavor.includes("개운")) tokens.push("개운");
  if (flavor.includes("느끼") || flavor.includes("고소")) tokens.push("고소", "느끼");

  if (cook.includes("튀기") || cook.includes("볶")) tokens.push("튀김");
  if (cook.includes("구운") || cook.includes("불")) tokens.push("불맛");
  if (cook.includes("끓") || cook.includes("삶")) tokens.push("끓인");
  if (cook.includes("날것")) tokens.push("날것");

  let best = { type_no: 1, score: -1 };

  for (const t of TYPE_PROFILES) {
    const combo = String(t.core_combo || "");
    let score = 0;
    for (const tk of tokens) if (combo.includes(tk)) score += 1;

    if (score > best.score || (score === best.score && Number(t.type_no) < Number(best.type_no))) {
      best = { type_no: Number(t.type_no), score };
    }
  }
  return best.type_no;
}

/*******************************************************
 * 안주/페어링 추천 (간단 점수화)
 *******************************************************/
function recommendDishesAndDrinks() {
  const drink = answers[5] || "";
  const flavor = answers[11] || "";
  const cook = answers[12] || "";

  const wantSpicy = (flavor.includes("매콤") || flavor.includes("얼큰"));
  const preferFried = (cook.includes("튀기") || cook.includes("볶"));
  const preferBoil = (cook.includes("끓") || cook.includes("삶"));

  const preferSoju = drink.includes("소주");
  const preferBeer = drink.includes("맥주");
  const preferMak = drink.includes("막걸리");
  const preferWine = (drink.includes("와인") || drink.includes("칵테일"));

  const scored = DISHES.map(d => {
    let s = 0;
    const spicy = Number(d.spicy_level || 0);
    const isSoup = Number(d.is_soup || 0) === 1;
    const isFried = Number(d.is_fried || 0) === 1;

    if (wantSpicy) s += spicy * 2;
    if (preferFried) s += isFried ? 5 : 0;
    if (preferBoil) s += isSoup ? 5 : 0;

    const bd = String(d.best_drink || "");
    if (preferSoju && bd.includes("소주")) s += 4;
    if (preferBeer && bd.includes("맥주")) s += 4;
    if (preferMak && bd.includes("막걸리")) s += 4;
    if (preferWine && (bd.includes("와인") || bd.includes("칵테일"))) s += 4;

    return { d, s };
  }).sort((a, b) => b.s - a.s);

  const top = [];
  const used = new Set();
  for (const item of scored) {
    const name = String(item.d.name || "").trim();
    if (!name || used.has(name)) continue;
    top.push(item.d);
    used.add(name);
    if (top.length >= 5) break;
  }

  const drinks = [];
  const pushDrink = (x) => {
    const v = String(x || "").trim();
    if (v && !drinks.includes(v)) drinks.push(v);
  };
  for (const d of top) {
    pushDrink(d.best_drink);
    pushDrink(d.alt_drink_1);
    pushDrink(d.alt_drink_2);
  }

  return {
    dishes: top.map(d => d.name).slice(0, 5),
    drinks: drinks.slice(0, 5)
  };
}

/*******************************************************
 * D. renderResultByTypeNo()
 *******************************************************/
function renderResultByTypeNo(typeNo) {
  const t = TYPE_PROFILES.find(x => String(x.type_no) === String(typeNo));
  const typeTitle = t ? String(t.keyword || "").trim() : "오늘의 유형";
  const typeSub = t ? String(t.core_combo || "").trim() : "선택 결과 기반 추천";

  const rec = recommendDishesAndDrinks();

  $("result-type-title").textContent = typeTitle || "오늘의 유형";
  $("result-type-subtitle").textContent = typeSub || "선택 결과 기반 추천";

  const anjuList = $("result-anju-list");
  const drinkList = $("result-drink-list");
  anjuList.innerHTML = "";
  drinkList.innerHTML = "";

  rec.dishes.forEach(v => {
    const li = document.createElement("li");
    li.textContent = v;
    anjuList.appendChild(li);
  });

  rec.drinks.forEach(v => {
    const li = document.createElement("li");
    li.textContent = v;
    drinkList.appendChild(li);
  });

  showOnly("result-card");
}

/*******************************************************
 * 앱 초기화 / 시작
 *******************************************************/
function resetAppToLanding() {
  currentIndex = 0;
  answers = {};
  showOnly("landing");
}

function startTest() {
  currentIndex = 0;
  showOnly("progress-wrap");
  elQuestionCard.classList.remove("hidden");
  renderQuestion(currentIndex);
}

function showError(msg) {
  showOnly("error");
  elErrorMsg.textContent = msg;
}

/*******************************************************
 * 공유 (간단)
 *******************************************************/
function toast(msg) {
  if (!elShareToast) return;
  elShareToast.textContent = msg;
  elShareToast.classList.remove("hidden");
  setTimeout(() => elShareToast.classList.add("hidden"), 1200);
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(location.href);
    toast("링크가 복사되었습니다.");
  } catch {
    toast("복사 실패(브라우저 권한 확인)");
  }
}

/*******************************************************
 * E. DOMContentLoaded
 *******************************************************/
document.addEventListener("DOMContentLoaded", async () => {
  try {
    showOnly("loading");
    await initDB();

    // 랜딩 참여자 수(임의: 로컬 저장 + 질문 완료 시 증가)
    const key = "anju_participants";
    const current = Number(localStorage.getItem(key) || 0);
    elParticipants.textContent = String(current);

    showOnly("landing");

    btnStart?.addEventListener("click", startTest);

    btnPrev?.addEventListener("click", () => {
      if (currentIndex <= 0) return;
      currentIndex -= 1;
      renderQuestion(currentIndex);
    });

    btnNext?.addEventListener("click", () => {
      const q = QUESTIONS[currentIndex];
      if (!q) return;
      if (!answers[q.q_no]) return;

      if (currentIndex === QUESTIONS.length - 1) {
        // 참여자수 +1
        const next = Number(localStorage.getItem(key) || 0) + 1;
        localStorage.setItem(key, String(next));
        elParticipants.textContent = String(next);

        const typeNo = pickTypeNoByAnswers();
        renderResultByTypeNo(typeNo);
        return;
      }

      currentIndex += 1;
      renderQuestion(currentIndex);
    });

    btnRestart?.addEventListener("click", resetAppToLanding);
    btnAgain?.addEventListener("click", resetAppToLanding);

    // 공유 버튼(링크복사만 실동작, 나머지는 자리만)
    document.querySelectorAll("[data-share]").forEach(btn => {
      btn.addEventListener("click", () => {
        const t = btn.getAttribute("data-share");
        if (t === "link") copyLink();
        else toast("공유 기능은 추후 연결");
      });
    });

  } catch (e) {
    console.error(e);
    showError(String(e?.message || e));
  }
});
