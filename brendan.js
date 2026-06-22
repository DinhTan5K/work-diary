// brendan.js
document.addEventListener('DOMContentLoaded', () => {
  // Tạo thẻ div cho con pet
  const pet = document.createElement('div');
  pet.classList.add('brendan-pet', 'walk-right'); // Bắt đầu đi sang phải
  document.body.appendChild(pet);

  let x = 0; // Vị trí X (pixel)
  let speed = 1.5; // Tốc độ (tăng nếu muốn nó chạy nhanh)
  let direction = 'right';

  // Vì mình phóng to bằng transform: scale(2.5) nên bề ngang thực tế của nó là 28 * 2.5 = 70px
  const petRealWidth = 70; 

  function patrol() {
    if (direction === 'right') {
      x += speed;
      // Đụng cạnh phải
      if (x + petRealWidth >= window.innerWidth) {
        x = window.innerWidth - petRealWidth;
        direction = 'left';
        pet.classList.replace('walk-right', 'walk-left'); // Đổi dòng sprite
      }
    } else {
      x -= speed;
      // Đụng cạnh trái
      if (x <= 0) {
        x = 0;
        direction = 'right';
        pet.classList.replace('walk-left', 'walk-right'); // Đổi dòng sprite
      }
    }

    // Cập nhật vị trí lên màn hình
    pet.style.left = `${x}px`;
    
    // Yêu cầu trình duyệt vẽ khung hình tiếp theo
    requestAnimationFrame(patrol);
  }

  // Khởi động!
  requestAnimationFrame(patrol);
});
