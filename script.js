/* ==========================================
   SugarTracker V2
   Part 1 - App Initialization
========================================== */

const STORAGE_KEY = "SugarTrackerV2";

/* ---------- Default Data ---------- */

const defaultData = {
    settings: {
        darkMode: false,
        sugarGoal: 25,
        waterGoal: 8
    },

    water: 0,

    diet: [],

    exercise: [],

    weight: []
};

/* ---------- Load Local Storage ---------- */

let appData = JSON.parse(localStorage.getItem(STORAGE_KEY));

if (!appData) {

    appData = structuredClone(defaultData);

    saveData();

}

/* ---------- Save ---------- */

function saveData() {

    localStorage.setItem(

        STORAGE_KEY,

        JSON.stringify(appData)

    );

}

/* ---------- Elements ---------- */

const pages = document.querySelectorAll(".page");

const navButtons = document.querySelectorAll(".nav");

const loader = document.getElementById("loader");

/* Dashboard */

const streakDays = document.getElementById("streakDays");

const todaySugar = document.getElementById("todaySugar");

const currentWeight = document.getElementById("currentWeight");

const bmi = document.getElementById("bmi");

const waterCount = document.getElementById("waterCount");

const exerciseMinutes = document.getElementById("exerciseMinutes");

/* Progress */

const sugarProgress = document.getElementById("sugarProgress");

const sugarProgressText = document.getElementById("sugarProgressText");

const exerciseProgress = document.getElementById("exerciseProgress");

const exerciseProgressText = document.getElementById("exerciseProgressText");

const waterProgress = document.getElementById("waterProgress");

const waterProgressText = document.getElementById("waterProgressText");

/* Theme */

const themeBtn = document.getElementById("themeBtn");

/* Forms */

const dietForm = document.getElementById("dietForm");

const exerciseForm = document.getElementById("exerciseForm");

const weightForm = document.getElementById("weightForm");

/* History */

const historyList = document.getElementById("historyList");

const searchInput = document.getElementById("search");

const filterSelect = document.getElementById("filter");

/* Canvas */

const canvas = document.getElementById("weightChart");

const ctx = canvas.getContext("2d");

/* ==========================================
Navigation
========================================== */

navButtons.forEach(button => {

    button.addEventListener("click", () => {

        navButtons.forEach(nav =>

            nav.classList.remove("active")

        );

        button.classList.add("active");

        pages.forEach(page =>

            page.classList.remove("active")

        );

        document
            .getElementById(button.dataset.page)
            .classList.add("active");

    });

});

/* ==========================================
Theme
========================================== */

function applyTheme() {

    if (appData.settings.darkMode) {

        document.body.classList.add("dark");

        themeBtn.textContent = "☀";

    } else {

        document.body.classList.remove("dark");

        themeBtn.textContent = "🌙";

    }

}

themeBtn.onclick = () => {

    appData.settings.darkMode =

        !appData.settings.darkMode;

    saveData();

    applyTheme();

};

/* ==========================================
Today's Date
========================================== */

function today() {

    return new Date()

        .toISOString()

        .substring(0,10);

}

document.getElementById("dietDate").value = today();

document.getElementById("exerciseDate").value = today();

document.getElementById("weightDate").value = today();

/* ==========================================
Loader
========================================== */

window.addEventListener("load",()=>{

    setTimeout(()=>{

        loader.style.display="none";

        renderDashboard();

    },500);

});

/* ==========================================
   Dashboard Functions
========================================== */

function formatDate(date){

    return new Date(date).toLocaleDateString();

}

function getTodaySugar(){

    const todayDate = today();

    let total = 0;

    appData.diet.forEach(item=>{

        if(item.date===todayDate){

            total += Number(item.sugar || 0);

        }

    });

    return total;

}

function getTodayExercise(){

    const todayDate = today();

    let total = 0;

    appData.exercise.forEach(item=>{

        if(item.date===todayDate){

            total += Number(item.duration || 0);

        }

    });

    return total;

}

function getLatestWeight(){

    if(appData.weight.length===0){

        return null;

    }

    return appData.weight[appData.weight.length-1];

}

/* ==========================================
Sugar-Free Streak
========================================== */

function calculateSugarStreak(){

    let streak = 0;

    const todayObj = new Date();

    while(true){

        const d = new Date(todayObj);

        d.setDate(todayObj.getDate()-streak);

        const key = d.toISOString().substring(0,10);

        const hasSugar = appData.diet.some(item=>{

            return item.date===key && Number(item.sugar)>0;

        });

        if(hasSugar){

            break;

        }

        streak++;

        if(streak>3650){

            break;

        }

    }

    return streak;

}

/* ==========================================
BMI
========================================== */

function calculateBMI(){

    const latest = getLatestWeight();

    if(!latest){

        return "--";

    }

    const weight = Number(latest.weight);

    const height = Number(latest.height);

    if(height<=0){

        return "--";

    }

    return (weight/(height*height)).toFixed(1);

}

/* ==========================================
Water
========================================== */

function increaseWater(){

    if(appData.water < appData.settings.waterGoal){

        appData.water++;

        saveData();

        renderDashboard();

    }

}

function resetWater(){

    appData.water = 0;

    saveData();

    renderDashboard();

}

/* ==========================================
Progress
========================================== */

function updateProgressBars(){

    const sugar = getTodaySugar();

    const sugarPercent = Math.min(

        (sugar/appData.settings.sugarGoal)*100,

        100

    );

    sugarProgress.value = sugarPercent;

    sugarProgressText.innerText =

        Math.round(sugarPercent)+"%";

    const exercise = getTodayExercise();

    const exerciseGoal = 30;

    const exercisePercent = Math.min(

        (exercise/exerciseGoal)*100,

        100

    );

    exerciseProgress.value = exercisePercent;

    exerciseProgressText.innerText =

        Math.round(exercisePercent)+"%";

    waterProgress.max =

        appData.settings.waterGoal;

    waterProgress.value =

        appData.water;

    waterProgressText.innerText =

        appData.water +

        " / " +

        appData.settings.waterGoal;

}

/* ==========================================
Dashboard
========================================== */

function renderDashboard(){

    streakDays.innerText =

        calculateSugarStreak();

    todaySugar.innerText =

        getTodaySugar()+" g";

    const latest = getLatestWeight();

    if(latest){

        currentWeight.innerText =

            latest.weight+" kg";

    }

    else{

        currentWeight.innerText="--";

    }

    bmi.innerText =

        calculateBMI();

    waterCount.innerText =

        appData.water +

        " / " +

        appData.settings.waterGoal;

    exerciseMinutes.innerText =

        getTodayExercise()+" min";

    updateProgressBars();

    drawWeightChart();

    renderHistory();

}

/* ==========================================
Water Shortcuts
========================================== */

document.addEventListener("keydown",(e)=>{

    if(e.key==="w"){

        increaseWater();

    }

});
/* ==========================================
   FORM SUBMISSIONS
========================================== */

/* ---------- Diet ---------- */

dietForm.addEventListener("submit", function (e) {

    e.preventDefault();

    const entry = {

        id: Date.now(),

        date: document.getElementById("dietDate").value,

        food: document.getElementById("foodName").value.trim(),

        calories: Number(document.getElementById("calories").value) || 0,

        sugar: Number(document.getElementById("sugar").value) || 0,

        notes: document.getElementById("dietNotes").value.trim()

    };

    if (entry.food === "") {

        alert("Please enter a food name.");

        return;

    }

    appData.diet.push(entry);

    saveData();

    dietForm.reset();

    document.getElementById("dietDate").value = today();

    renderDashboard();

    showToast("Diet saved successfully.");

});


/* ---------- Exercise ---------- */

exerciseForm.addEventListener("submit", function (e) {

    e.preventDefault();

    const entry = {

        id: Date.now(),

        date: document.getElementById("exerciseDate").value,

        exercise: document.getElementById("exerciseName").value.trim(),

        duration: Number(document.getElementById("duration").value) || 0,

        caloriesBurned: Number(document.getElementById("caloriesBurned").value) || 0

    };

    if (entry.exercise === "") {

        alert("Please enter an exercise.");

        return;

    }

    appData.exercise.push(entry);

    saveData();

    exerciseForm.reset();

    document.getElementById("exerciseDate").value = today();

    renderDashboard();

    showToast("Exercise saved.");

});


/* ---------- Weight ---------- */

weightForm.addEventListener("submit", function (e) {

    e.preventDefault();

    const weight = Number(document.getElementById("weight").value);

    const height = Number(document.getElementById("height").value);

    if (!weight || !height) {

        alert("Please enter both weight and height.");

        return;

    }

    appData.weight.push({

        id: Date.now(),

        date: document.getElementById("weightDate").value,

        weight,

        height

    });

    saveData();

    weightForm.reset();

    document.getElementById("weightDate").value = today();

    renderDashboard();

    showToast("Weight updated.");

});


/* ==========================================
   TOAST NOTIFICATION
========================================== */

let toast = document.querySelector(".toast");

if (!toast) {

    toast = document.createElement("div");

    toast.className = "toast";

    document.body.appendChild(toast);

}

function showToast(message) {

    toast.textContent = message;

    toast.classList.add("show");

    setTimeout(() => {

        toast.classList.remove("show");

    }, 2500);

}


/* ==========================================
   UTILITIES
========================================== */

function clearForms() {

    dietForm.reset();

    exerciseForm.reset();

    weightForm.reset();

    document.getElementById("dietDate").value = today();

    document.getElementById("exerciseDate").value = today();

    document.getElementById("weightDate").value = today();

}


/* ==========================================
   AUTO SAVE
========================================== */

window.addEventListener("beforeunload", saveData);

/* ==========================================
   HISTORY
========================================== */

function getAllEntries() {

    const list = [];

    appData.diet.forEach(item => {
        list.push({
            type: "diet",
            ...item
        });
    });

    appData.exercise.forEach(item => {
        list.push({
            type: "exercise",
            ...item
        });
    });

    appData.weight.forEach(item => {
        list.push({
            type: "weight",
            ...item
        });
    });

    list.sort((a, b) => new Date(b.date) - new Date(a.date));

    return list;

}

/* ==========================================
   RENDER HISTORY
========================================== */

function renderHistory() {

    historyList.innerHTML = "";

    let records = getAllEntries();

    const search = searchInput.value
        .toLowerCase()
        .trim();

    const filter = filterSelect.value;

    records = records.filter(item => {

        const matchesSearch =
            JSON.stringify(item)
            .toLowerCase()
            .includes(search);

        const matchesFilter =
            filter === "all" ||
            item.type === filter;

        return matchesSearch && matchesFilter;

    });

    if(records.length===0){

        historyList.innerHTML=`
        <div class="empty">

            <h2>No Records</h2>

            <p>Add your first entry.</p>

        </div>
        `;

        return;

    }

    records.forEach(item=>{

        const card=document.createElement("div");

        card.className="history-card";

        let body="";

        if(item.type==="diet"){

            body=`
            <b>Food:</b> ${item.food}<br>
            <b>Calories:</b> ${item.calories}<br>
            <b>Sugar:</b> ${item.sugar} g<br>
            <b>Notes:</b> ${item.notes || "-"}
            `;

        }

        if(item.type==="exercise"){

            body=`
            <b>Exercise:</b> ${item.exercise}<br>
            <b>Duration:</b> ${item.duration} min<br>
            <b>Calories Burned:</b> ${item.caloriesBurned}
            `;

        }

        if(item.type==="weight"){

            body=`
            <b>Weight:</b> ${item.weight} kg<br>
            <b>Height:</b> ${item.height} m
            `;

        }

        card.innerHTML=`

        <div class="history-header">

            <div>

                <div class="history-title">

                    ${item.type.toUpperCase()}

                </div>

                <div class="history-date">

                    ${formatDate(item.date)}

                </div>

            </div>

        </div>

        <div class="history-body">

            ${body}

        </div>

        <div class="history-footer">

            <button
            class="edit-btn"
            onclick="editEntry('${item.type}',${item.id})">

            Edit

            </button>

            <button
            class="delete-btn"
            onclick="deleteEntry('${item.type}',${item.id})">

            Delete

            </button>

        </div>

        `;

        historyList.appendChild(card);

    });

}

/* ==========================================
SEARCH
========================================== */

searchInput.addEventListener("input",renderHistory);

filterSelect.addEventListener("change",renderHistory);

/* ==========================================
DELETE
========================================== */

function deleteEntry(type,id){

    if(!confirm("Delete this entry?")){

        return;

    }

    appData[type]=appData[type].filter(

        item=>item.id!==id

    );

    saveData();

    renderDashboard();

    showToast("Entry deleted.");

}

/* ==========================================
EDIT
========================================== */

function editEntry(type,id){

    const list=appData[type];

    const item=list.find(x=>x.id===id);

    if(!item){

        return;

    }

    if(type==="diet"){

        const food=prompt("Food",item.food);

        if(food===null) return;

        const sugar=prompt("Sugar",item.sugar);

        if(sugar===null) return;

        const calories=prompt(

            "Calories",

            item.calories

        );

        if(calories===null) return;

        const notes=prompt(

            "Notes",

            item.notes

        );

        item.food=food;

        item.sugar=Number(sugar);

        item.calories=Number(calories);

        item.notes=notes;

    }

    if(type==="exercise"){

        const ex=prompt(

            "Exercise",

            item.exercise

        );

        if(ex===null) return;

        const duration=prompt(

            "Duration",

            item.duration

        );

        if(duration===null) return;

        item.exercise=ex;

        item.duration=Number(duration);

    }

    if(type==="weight"){

        const weight=prompt(

            "Weight",

            item.weight

        );

        if(weight===null) return;

        const height=prompt(

            "Height",

            item.height

        );

        if(height===null) return;

        item.weight=Number(weight);

        item.height=Number(height);

    }

    saveData();

    renderDashboard();

    showToast("Entry updated.");

}
/* ==========================================
   PART 5 - Charts, Backup & App Startup
========================================== */

/* ---------- Weight Chart ---------- */

function drawWeightChart() {

    if (!canvas || !ctx) return;

    canvas.width = canvas.clientWidth;
    canvas.height = 300;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (appData.weight.length < 2) {

        ctx.fillStyle = "#888";
        ctx.font = "18px Arial";
        ctx.fillText("Add at least 2 weight entries", 20, 40);
        return;
    }

    const values = appData.weight.map(x => Number(x.weight));

    const min = Math.min(...values);
    const max = Math.max(...values);

    const padding = 40;

    ctx.beginPath();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#3b82f6";

    values.forEach((value, index) => {

        const x =
            padding +
            index *
            ((canvas.width - padding * 2) / (values.length - 1));

        const y =
            canvas.height -
            padding -
            ((value - min) / ((max - min) || 1)) *
            (canvas.height - padding * 2);

        if (index === 0)
            ctx.moveTo(x, y);
        else
            ctx.lineTo(x, y);

    });

    ctx.stroke();

    values.forEach((value, index) => {

        const x =
            padding +
            index *
            ((canvas.width - padding * 2) / (values.length - 1));

        const y =
            canvas.height -
            padding -
            ((value - min) / ((max - min) || 1)) *
            (canvas.height - padding * 2);

        ctx.beginPath();
        ctx.fillStyle = "#2563eb";
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();

    });

}

/* ---------- Export ---------- */

document
.getElementById("exportData")
.addEventListener("click", () => {

    const blob = new Blob(

        [JSON.stringify(appData, null, 2)],

        {
            type: "application/json"
        }

    );

    const a = document.createElement("a");

    a.href = URL.createObjectURL(blob);

    a.download = "SugarTracker_Backup.json";

    a.click();

});

/* ---------- Import ---------- */

document
.getElementById("importData")
.addEventListener("change", e => {

    const file = e.target.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = function () {

        try {

            appData = JSON.parse(reader.result);

            saveData();

            renderDashboard();

            showToast("Backup restored");

        }

        catch {

            alert("Invalid backup file");

        }

    };

    reader.readAsText(file);

});

/* ---------- Clear ---------- */

document
.getElementById("clearData")
.addEventListener("click", () => {

    if (!confirm("Delete all data?"))
        return;

    appData = structuredClone(defaultData);

    saveData();

    renderDashboard();

    showToast("All data deleted");

});

/* ---------- Floating Button ---------- */

const fab = document.getElementById("fab");

fab.addEventListener("click", () => {

    document
    .getElementById("dietPage")
    .classList
    .add("active");

});

/* ---------- Daily Water Reset ---------- */

const lastOpen =
localStorage.getItem("lastOpen");

if (lastOpen !== today()) {

    appData.water = 0;

    localStorage.setItem(
        "lastOpen",
        today()
    );

    saveData();

}

/* ---------- Window Resize ---------- */

window.addEventListener(

    "resize",

    drawWeightChart

);

/* ---------- App Start ---------- */

applyTheme();

renderDashboard();

drawWeightChart();

showToast("Welcome to SugarTracker V2");
