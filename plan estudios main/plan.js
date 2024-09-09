

const classes = document.querySelectorAll('#class-list li');

function aprobarClase(claseAprobada) {
  // Desbloquear las clases que tienen como prerrequisito la clase aprobada
  classes.forEach((clase) => {
    const prerequisitos = clase.getAttribute('data-prerequisites');
    if (prerequisitos === claseAprobada) {
      clase.classList.remove('locked');
    }
  });
  
  // Deshabilitar el botón de la clase aprobada
  document.querySelector(`li:contains('${claseAprobada}') button`).disabled = true;
}
