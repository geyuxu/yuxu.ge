import{d as i,c as e}from"./consts.DinVc4zm.js";import{r as g}from"./zh-cn.l1puoSTI.js";import"./_commonjsHelpers.Cpj98o6Y.js";i.extend(g);i.locale(e.lang);let l=document.getElementById("more-btn");l.addEventListener("click",function(){d()});let o="",c="",r="";await p();await d();async function p(){let a=await(await fetch(`${e.memosUrl}/api/v1/users:search?filter=username=='${e.memosUsername}'`)).json();o=a.users[0].avatarUrl?a.users[0].avatarUrl:"https://memos.cirry.cn/full-logo.webp",c=a.users[0].name}async function d(){let a=await(await fetch(`${e.memosUrl}/api/v1/memos?filter=creator=='${c}'&&visibilities==['PUBLIC']&pageSize=${e.memosPageSize}&pageToken=${r}`)).json(),m="";a.memos.forEach(s=>{let n="";s.resources.length>0&&s.resources.filter(t=>["image/jpeg","image/png","image/jpg","image/webp"].includes(t.type)).forEach(t=>{n+=`<img src="${e.memosUrl+"/file/"+t.name+"/"+t.filename}" alt="${t.filename}" />`}),m+=`
          <div class="flex flex-col  shadow flex flex-col bg-skin-card p-4 mb-4 rounded-lg">
            <div class="flex w-full memos-center">
              <img src="${o}" class="github-avatar mr-4" alt="avatar" />
              <div>@${e.memosUsername}</div>
            </div>
            <p class="memo-content-wrapper my-4"> ${s.snippet}</p>
            <div>${n}</div>

            <p>${i(s.updateTime).fromNow()} • ${i(s.updateTime).format("YYYY-MM-DD HH:mm")}</p>
          </div>
          `}),document.getElementById("memos").innerHTML+=m.toString(),r=a.nextPageToken,r===""?l.classList.add("hidden"):l.classList.remove("hidden")}
