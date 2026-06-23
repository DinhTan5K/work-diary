// brendan.js - Bottom Patrol Pets
document.addEventListener('DOMContentLoaded', () => {
  const petWidth = 70; 
  const petHeight = 70; 

  const hour = new Date().getHours();
  let numPets = 0;
  if (hour >= 5 && hour < 12) numPets = 3; // Ca sáng: 3 con
  else if (hour >= 12 && hour < 18) numPets = 2; // Ca trưa/chiều: 2 con
  else if (hour >= 18 && hour < 22) numPets = 1; // Ca tối: 1 con
  else numPets = 0; // Khuya: nghỉ ngơi

  const allPetsConfig = [
    {
      className: 'brendan-pet',
      x: 10,
      speed: 1.0,
      dir: 'right',
      cls: { left: 'walk-left', right: 'walk-right' }
    },
    {
      className: 'wally-pet',
      x: window.innerWidth / 2,
      speed: 0.9,
      dir: 'left',
      cls: { left: 'wally-walk-left', right: 'wally-walk-right' }
    },
    {
      className: 'brendan3-pet',
      x: window.innerWidth - petWidth - 10,
      speed: 1.1,
      dir: 'left',
      cls: { left: 'brendan3-walk-left', right: 'brendan3-walk-right' }
    }
  ];

  const petsData = [];
  for (let i = 0; i < numPets; i++) {
    const config = allPetsConfig[i];
    const el = document.createElement('div');
    el.classList.add(config.className);
    document.body.appendChild(el);
    petsData.push({
      el: el,
      x: config.x,
      speed: config.speed,
      dir: config.dir,
      cls: config.cls
    });
  }

  function updatePet(pet) {
    const W = window.innerWidth - petWidth;
    const nav = document.querySelector('.tabs-nav');
    
    // Mặc định đi dưới cùng màn hình
    let floorY = window.innerHeight - petHeight;
    
    // Nếu tab nav đang hiển thị thì đi trên viền tab nav
    if (nav && nav.offsetHeight > 0) {
      floorY = nav.getBoundingClientRect().top - petHeight + 15;
    }

    // Di chuyển theo hướng hiện tại
    if (pet.dir === 'left') pet.x -= pet.speed;
    if (pet.dir === 'right') pet.x += pet.speed;

    pet.el.style.animationPlayState = 'running';

    // Đụng 2 cạnh màn hình thì quay đầu
    if (pet.dir === 'right' && pet.x >= W) { 
      pet.x = W; 
      pet.dir = 'left'; 
    }
    else if (pet.dir === 'left' && pet.x <= 0) { 
      pet.x = 0; 
      pet.dir = 'right'; 
    }

    // Xóa hết class hướng cũ, cập nhật class hướng mới
    pet.el.classList.remove(pet.cls.left, pet.cls.right, 'walk-up', 'walk-down', 'wally-walk-up', 'wally-walk-down', 'brendan3-walk-up', 'brendan3-walk-down');
    pet.el.classList.add(pet.cls[pet.dir]);

    pet.el.style.transform = `translate3d(${pet.x}px, ${floorY}px, 0)`;
  }

  function loop() {
    petsData.forEach(pet => updatePet(pet));
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
});
