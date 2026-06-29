const KEY='sugarTrackerV2';
const data=JSON.parse(localStorage.getItem(KEY)||'{"diet":[],"exercise":[],"weight":[]}');
const save=()=>localStorage.setItem(KEY,JSON.stringify(data));
const today=()=>new Date().toISOString().slice(0,10);
['dietDate','exerciseDate','weightDate'].forEach(id=>document.getElementById(id).value=today());

dietForm.onsubmit=e=>{
e.preventDefault();
data.diet.push({date:dietDate.value,meal:meal.value,sugar:+sugar.value||0,notes:dietNotes.value});
save();dietForm.reset();dietDate.value=today();render();
}
exerciseForm.onsubmit=e=>{
e.preventDefault();
data.exercise.push({date:exerciseDate.value,type:exerciseType.value,min:+minutes.value||0});
save();exerciseForm.reset();exerciseDate.value=today();render();
}
weightForm.onsubmit=e=>{
e.preventDefault();
data.weight.push({date:weightDate.value,weight:+weight.value});
save();weightForm.reset();weightDate.value=today();render();
}
function render(){
const hist=document.getElementById('history');
hist.innerHTML='';
[...data.diet.map(x=>({...x,t:'Diet'})),...data.exercise.map(x=>({...x,t:'Exercise'})),...data.weight.map(x=>({...x,t:'Weight'}))]
.sort((a,b)=>b.date.localeCompare(a.date))
.forEach(i=>{
const d=document.createElement('div');
d.textContent=JSON.stringify(i);
hist.appendChild(d);
});
const latest=data.weight.at(-1);
latestWeight.textContent=latest?latest.weight+' kg':'-';
const week=new Date();week.setDate(week.getDate()-6);
weeklyExercise.textContent=data.exercise.filter(e=>new Date(e.date)>=week).reduce((a,b)=>a+b.min,0)+' min';
let streak=0;
for(let i=0;;i++){
const d=new Date();d.setDate(d.getDate()-i);
const key=d.toISOString().slice(0,10);
const sum=data.diet.filter(x=>x.date===key).reduce((a,b)=>a+b.sugar,0);
if(sum===0)streak++;else break;
}
streak.textContent=streak+' days';
}
render();
