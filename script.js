const products = [
  {id:1,brand:'CHANEL',title:'Classic Flap Medium',category:'Bags',price:26800,condition:'Excellent',badge:'Authenticated',visual:'CC'},
  {id:2,brand:'ROLEX',title:'Datejust 36',category:'Watches',price:34900,condition:'Very good',badge:'Verified seller',visual:'◷'},
  {id:3,brand:'CARTIER',title:'Love Bracelet',category:'Jewellery',price:22800,condition:'Like new',badge:'Authenticated',visual:'◇'},
  {id:4,brand:'LOUIS VUITTON',title:'Capucines Mini',category:'Bags',price:17900,condition:'Excellent',badge:'New listing',visual:'LV'},
  {id:5,brand:'HERMÈS',title:'Oran Sandals',category:'Shoes',price:2750,condition:'Very good',badge:'Authenticated',visual:'H'},
  {id:6,brand:'DIOR',title:'Oblique Saddle Bag',category:'Bags',price:11500,condition:'Good',badge:'Price drop',visual:'D'},
  {id:7,brand:'GUCCI',title:'GG Wool Blazer',category:'Fashion',price:3200,condition:'Excellent',badge:'Verified seller',visual:'GG'},
  {id:8,brand:'BEARBRICK',title:'Royal Selangor 400%',category:'Collectibles',price:4100,condition:'Like new',badge:'Rare find',visual:'✦'}
];
let activeCategory = 'All';
let wishlist = new Set(JSON.parse(localStorage.getItem('du2bao2-wishlist') || '[]'));
const grid = document.querySelector('#productGrid');
const searchInput = document.querySelector('#searchInput');
const sortSelect = document.querySelector('#sortSelect');
const wishlistCount = document.querySelector('#wishlistCount');
const emptyState = document.querySelector('#emptyState');
const sellDialog = document.querySelector('#sellDialog');
const loginDialog = document.querySelector('#loginDialog');
const toast = document.querySelector('#toast');
const money = new Intl.NumberFormat('en-MY',{style:'currency',currency:'MYR',maximumFractionDigits:0});
function showToast(message){toast.textContent=message;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2200)}
function updateWishlist(){wishlistCount.textContent=wishlist.size;localStorage.setItem('du2bao2-wishlist',JSON.stringify([...wishlist]))}
function render(){
  const query=searchInput.value.toLowerCase().trim();
  let items=products.filter(p=>(activeCategory==='All'||p.category===activeCategory)&&(`${p.brand} ${p.title}`.toLowerCase().includes(query)));
  if(sortSelect.value==='low')items.sort((a,b)=>a.price-b.price);
  if(sortSelect.value==='high')items.sort((a,b)=>b.price-a.price);
  grid.innerHTML=items.map(p=>`<article class="product-card">
    <div class="product-image"><span class="badge">${p.badge}</span><button class="heart ${wishlist.has(p.id)?'saved':''}" data-id="${p.id}" aria-label="Save ${p.title}">${wishlist.has(p.id)?'♥':'♡'}</button><div class="visual">${p.visual}</div></div>
    <div class="product-copy"><span class="brand-name">${p.brand}</span><h3>${p.title}</h3><div class="price-line"><span class="price">${money.format(p.price)}</span><span class="condition">${p.condition}</span></div></div>
  </article>`).join('');
  emptyState.hidden=items.length>0;
  document.querySelectorAll('.heart').forEach(btn=>btn.addEventListener('click',()=>{const id=Number(btn.dataset.id);wishlist.has(id)?wishlist.delete(id):wishlist.add(id);updateWishlist();render();showToast(wishlist.has(id)?'Saved to wishlist':'Removed from wishlist')}));
}
document.querySelectorAll('.category').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.category').forEach(x=>x.classList.remove('active'));btn.classList.add('active');activeCategory=btn.dataset.category;render()}));
searchInput.addEventListener('input',render);sortSelect.addEventListener('change',render);
['sellButton','heroSellButton'].forEach(id=>document.querySelector(`#${id}`).addEventListener('click',()=>sellDialog.showModal()));
document.querySelector('#loginButton').addEventListener('click',()=>loginDialog.showModal());
document.querySelector('#wishlistButton').addEventListener('click',()=>showToast(`${wishlist.size} item${wishlist.size===1?'':'s'} saved`));
document.querySelector('#sellForm').addEventListener('submit',e=>{e.preventDefault();sellDialog.close();e.target.reset();showToast('Listing received — demo mode')});
document.querySelector('.login-form').addEventListener('submit',e=>{e.preventDefault();loginDialog.close();showToast('Login requires backend connection')});
updateWishlist();render();
