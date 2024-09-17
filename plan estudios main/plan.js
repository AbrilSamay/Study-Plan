
 // Selecciona todos los botones y las secciones de información
 const buttons = document.querySelectorAll('.big-button');
 const infoSections = document.querySelectorAll('.notVisible');

 // Itera sobre todos los botones
 buttons.forEach((button, index) => {
   button.addEventListener('click', function() {
     infoSections[index].classList.toggle('extended');
   });
 });


 // Apartado desbloqueables, generales 


const columnsWidth = document.querySelectorAll('.spacer');
const GN = document.querySelectorAll('.GN');
const bigColumns = document.querySelectorAll ('.clasesGN')

columnsWidth.forEach((button, index) => {
  button.addEventListener('click', function() {
    GN[index].classList.toggle('gnExtended');
    bigColumns[index].classList.toggle('clasesGNExtended')
  });
});

