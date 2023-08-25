'use strict';

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  clicks = 0;

  constructor(coords, distance, duration) {
    // this.date = ...
    // this.id = ...
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }

  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = 'running';

  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';

  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    // this.type = 'cycling';
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    // km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

// const run1 = new Running([39, -12], 5.2, 24, 178);
// const cycling1 = new Cycling([39, -12], 27, 95, 523);
// console.log(run1, cycling1);

///////////////////////////////////////
// APPLICATION ARCHITECTURE
const form = document.querySelector('.form');
const sideBar = document.querySelector('.sidebar');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const btnDeleteAll = document.querySelector('.btn-clear-all');

class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];
  mapMarker = {};
  #workoutToUpdate = {};
  #workoutElToUpdate;
  #workoutMarkerToUpdate;
  sorted = false;

  constructor() {
    // Get user's position
    this._getPosition();

    // Get data from local storage
    this._getLocalStorage();

    // Attach event handlers
    // form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
    containerWorkouts.addEventListener('click', this._deleteWorkout.bind(this));
    containerWorkouts.addEventListener('click', this._editWorkout.bind(this));
    sideBar.addEventListener('click', this._sortWorkouts.bind(this));
    btnDeleteAll.addEventListener('click', this._deletAllWorkouts.bind(this));
  }

  _addFormEventListenerOnce() {
    if (!form.submittedOnce) {
      form.addEventListener('submit', this._newWorkout.bind(this));
      form.submittedOnce = true;
    }
  }

  _getPosition() {
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('Could not get your position');
        }
      );
  }

  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;

    // console.log(`https://www.google.pt/maps/@${latitude},${longitude}`);

    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // Handling clicks on map
    this.#map.on('click', this._showForm.bind(this));

    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;

    form.classList.remove('hidden');
    inputDistance.focus();

    this._addFormEventListenerOnce();
    // form.addEventListener('submit', this._newWorkout.bind(this));
  }

  _hideForm() {
    // Empty inputs
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';

    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {
    e.preventDefault();
    e.stopPropagation();
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    // Get data from form
    const type = inputType.value;

    const distance = +inputDistance.value;
    const duration = +inputDuration.value;

    let { lat, lng } = this.#mapEvent.latlng;

    let workout;

    // If workout running, create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;

      // Check if data is valid
      if (
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      ) {
        return alert('Inputs have to be positive numbers!');
      }

      workout = new Running([lat, lng], distance, duration, cadence);

      if (Object.values(this.#workoutToUpdate).length > 0) {
        workout.id = this.#workoutToUpdate.id;
      }
    }

    // If workout cycling, create cycling object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;

      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      ) {
        return alert('Inputs have to be positive numbers!');
      }
      workout = new Cycling([lat, lng], distance, duration, elevation);

      if (Object.values(this.#workoutToUpdate).length > 0) {
        workout.id = this.#workoutToUpdate.id;
      }
    }

    // Add new object to workout array
    if (this.#workouts.some(work => work.id === workout.id)) {
      const workIndex = this.#workouts.findIndex(
        work => work.id === workout.id
      );
      this.#workouts.splice(workIndex, 1);

      // const workouts = document.querySelectorAll('.workout');
      // const workoutEl = [...workouts].find(work => {
      //   console.log(work.dataset.id);
      // });
      this.#workoutElToUpdate.remove();
      // this.#workoutMarkerToUpdate.remove();
      this.#workoutToUpdate = {};
      this.#workoutElToUpdate;
      this.#workoutMarkerToUpdate;
    }
    this.#workouts.push(workout);

    // Render workout on map as marker
    this._renderWorkoutMarker(workout);

    // Render workout on list
    this._renderWorkout(workout);

    // Hide form + clear input fields
    this._hideForm();

    // Set local storage to all workouts
    this._setLocalStorage(this.#workouts);
  }

  async _renderWorkoutMarker(workout) {
    try {
      const locationAddress = await this._getRevGeo(...workout.coords);
      const marker = L.marker(workout.coords)
        .addTo(this.#map)
        .bindPopup(
          L.popup({
            maxWidth: 250,
            minWidth: 100,
            autoClose: false,
            closeOnClick: false,
            className: `${workout.type}-popup`,
          })
        )
        .setPopupContent(
          `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} in  ${locationAddress}`
        )
        .openPopup();

      this.mapMarker[workout.id] = marker;
    } catch (error) {
      console.error(error.message);
    }
  }

  _renderWorkout(workout) {
    let html = `
      <li class="workout workout--${workout.type}" data-id="${workout.id}">
        <h2 class="workout__title">${workout.description}
          <div class="icons">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="w-6 h-6 icon-new btn-edit"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125"
              />
            </svg>

            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="w-6 h-6 icon-X icon-new btn-delete"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
        </h2>
        <div class="workout__details">
          <span class="workout__icon">${
            workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
          }</span>
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>
    `;

    if (workout.type === 'running')
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.pace.toFixed(1)}</span>
          <span class="workout__unit">min/km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">🦶🏼</span>
          <span class="workout__value">${workout.cadence}</span>
          <span class="workout__unit">spm</span>
        </div>
      </li>
      `;

    if (workout.type === 'cycling')
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.speed.toFixed(1)}</span>
          <span class="workout__unit">km/h</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⛰</span>
          <span class="workout__value">${workout.elevationGain}</span>
          <span class="workout__unit">m</span>
        </div>
      </li>
      `;

    form.insertAdjacentHTML('afterend', html);
  }

  _moveToPopup(e) {
    // BUGFIX: When we click on a workout before the map has loaded, we get an error. But there is an easy fix:
    if (!this.#map) return;

    const workoutEl = e.target.closest('.workout');

    if (!workoutEl) return;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    if (this.#workouts.length < 0) return;

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });

    // using the public interface
    // workout.click();
  }

  _setLocalStorage(workout) {
    localStorage.setItem('workouts', JSON.stringify(workout));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;

    this.#workouts = data;

    this.#workouts.forEach(work => {
      this._renderWorkout(work);
    });
  }

  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }

  _deleteWorkout(e) {
    e.stopPropagation();

    const btnDeleteWorkout = e.target.closest('.btn-delete');

    if (!btnDeleteWorkout) return;

    const workoutEl = btnDeleteWorkout.closest('.workout');

    if (!workoutEl) return;

    const workoutIndex = this.#workouts.findIndex(
      work => work.id === workoutEl.dataset.id
    );

    if (workoutIndex !== -1) {
      const deletedWorkout = this.#workouts.splice(workoutIndex, 1)[0];
      const marker = this.mapMarker[deletedWorkout.id];
      if (!marker) return;
      this.#map.removeLayer(marker);
      marker.unbindPopup();
      marker.closePopup();
      marker.remove();

      delete this.mapMarker[deletedWorkout.id];
    }

    this._setLocalStorage(this.#workouts);

    workoutEl.remove();
  }

  _editWorkout(e) {
    e.stopPropagation();
    const btnEditWorkout = e.target.closest('.btn-edit');
    if (!btnEditWorkout) return;

    const workoutEl = btnEditWorkout.closest('.workout');
    if (!workoutEl) return;

    this.#workoutElToUpdate = workoutEl;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    const workoutMarker = Object.entries(this.mapMarker).find(
      obj => obj[0] === workout.id
    )[1];

    this.#workoutMarkerToUpdate = workoutMarker;

    this.#workoutToUpdate = workout;

    this.#mapEvent = {
      latlng: { lat: workout.coords[0], lng: workout.coords[1] },
    };
    this._showForm(this.#mapEvent);

    this._updateForm(workout);

    this._addFormEventListenerOnce();
  }

  _updateForm(workout) {
    this._showForm(this.#mapEvent);
    inputDistance.value = `${workout.distance}`;
    inputDuration.value = `${workout.duration}`;

    if (workout.type === 'running') {
      inputType.value = 'running';
      inputCadence.value = `${workout.cadence}`;
      inputElevation.closest('.form__row').classList.add('form__row--hidden');
      inputCadence.closest('.form__row').classList.remove('form__row--hidden');
    }
    if (workout.type === 'cycling') {
      inputType.value = 'cycling';
      inputElevation.value = `${workout.elevationGain}`;
      inputCadence.closest('.form__row').classList.add('form__row--hidden');
      inputElevation
        .closest('.form__row')
        .classList.remove('form__row--hidden');
    }
  }

  _deletAllWorkouts() {
    const workoutEls = document.querySelectorAll('.workout');
    workoutEls.forEach(work => work.remove());
    this.#workouts.splice(0, this.#workouts.length);

    // Remove markers
    Object.entries(this.mapMarker)
      .map(arr => arr[1])
      .forEach(marker => marker.remove());

    localStorage.clear();
  }

  _sortWorkouts(e) {
    // select btn
    const btnSort = e.target.closest('.btn-sort-type');
    if (!btnSort) return;

    const unsortedWorkout = this.#workouts;

    // sort by type
    const sortedWorkout = this.#workouts
      .slice()
      .sort((a, b) => (a.type > b.type ? 1 : -1));

    // Remove unsorted workout elements
    document.querySelectorAll('.workout').forEach(workEl => workEl.remove());

    // check current rendered workout
    if (!this.sorted) {
      sortedWorkout.forEach(work => this._renderWorkout(work));
      this.sorted = !this.sorted;
    } else {
      unsortedWorkout.forEach(work => this._renderWorkout(work));
      this.sorted = !this.sorted;
    }

    // Render sorted workout
  }

  async _getRevGeo(lat, long) {
    try {
      const response = await fetch(
        `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${long}&apiKey=42f440777f73424aa430be807043e579`
      );

      if (!response.ok)
        throw new Error('Something went wrong. Please try again!');
      const data = await response.json();
      const location = `${data.features[0].properties?.city ?? ''} ${
        data.features[0].properties?.country
      }`;

      return location;
    } catch (error) {
      throw error;
    }
  }
}

const app = new App();
