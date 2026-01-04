const grid = document.getElementById('videoGrid');
const search = document.getElementById('search');

function makeCard(v, id){
  // v is the data object, id is the document ID
  const a = document.createElement('a');
  // Pass the ID or the URL. Let's pass the object via query param or just ID if we had individual pages reading from DB
  // For now simple: pass the file URL directly as 'v' param like before, OR better, pass the 'id' and fetch in watch.html
  // Let's stick to the URL pattern for backward compatibility with 'watch.html' if we don't change it much,
  // BUT watch.html expects existing static files. We should update watch.html to take a URL directly.
  
  // Use AppConfig to generate full URL
  const fullUrl = AppConfig.apiUrl('/' + v.fileUrl);
  
  a.href = `watch.html?v=${encodeURIComponent(fullUrl)}&t=${encodeURIComponent(v.title)}`;
  a.className = 'card';

  const thumbWrap = document.createElement('div');
  thumbWrap.className = 'thumb-wrap';
  const vid = document.createElement('video');
  vid.className = 'thumb';
  vid.src = fullUrl;
  vid.muted = true;
  vid.playsInline = true;
  vid.preload = 'metadata';
  vid.loop = true; // Preview loop
  
  thumbWrap.appendChild(vid);

  const body = document.createElement('div');
  body.className = 'card-body';
  const title = document.createElement('div');
  title.className = 'title';
  title.textContent = v.title || "Untitled";
  
  const meta = document.createElement('div');
  meta.className = 'meta';
  // safely show email, maybe truncate
  const author = v.userEmail ? v.userEmail.split('@')[0] : 'Anonymous';
  meta.innerHTML = `<span class="small">By ${author}</span>`;

  body.appendChild(title);
  body.appendChild(meta);

  a.appendChild(thumbWrap);
  a.appendChild(body);

  // Preview logic
  a.addEventListener('mouseenter', ()=>{ try{ vid.play(); }catch(e){} });
  a.addEventListener('mouseleave', ()=>{ try{ vid.pause(); vid.currentTime = 0; }catch(e){} });

  return a;
}

function render(docList){
  grid.innerHTML = '';
  docList.forEach(doc => {
      grid.appendChild(makeCard(doc.data(), doc.id));
  });
}

// Initial Render
fetch(AppConfig.apiUrl('/api/videos'))
    .then(res => res.json())
    .then(videos => {
        if (videos.length === 0) {
            grid.innerHTML = '<p style="color:#aaa;text-align:center;width:100%;">No videos found.</p>';
        } else {
            // Transform to format expected by makeCard if needed, or update makeCard
            // data() was used on doc. Now we have plain objects.
            const docList = videos.map(v => ({
                id: v.id,
                data: () => v // Adapter so makeCard works without changes
            }));
            render(docList);
        }
    })
    .catch(err => {
        console.error("Error getting videos: ", err);
        grid.innerHTML = '<p style="color:#aaa;text-align:center;width:100%;">Could not load videos.</p>';
    });

// Search (Client-side filtering for simplicity, or we do a new query)
search.addEventListener('input', ()=>{
  const q = search.value.trim().toLowerCase();
  // For client side filter, we'd need to keep the full list in memory. 
  // For now, let's just re-query or ignore. complex with firestore limits.
  // Let's just do a simple reload-based search is too heavy. 
  // Simplest: Hide DOM elements that don't match.
  const cards = grid.getElementsByClassName('card');
  Array.from(cards).forEach(card => {
      const text = card.textContent.toLowerCase();
      card.style.display = text.includes(q) ? 'flex' : 'none';
  });
});
