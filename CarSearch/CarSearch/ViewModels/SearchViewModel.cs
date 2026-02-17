using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Windows.Input;
using CarSearch.Models;
using CarSearch.Services;

namespace CarSearch.ViewModels
{
    public class SearchViewModel : INotifyPropertyChanged
    {
        private readonly VehicleApiService _api;

        private string _plateInput = string.Empty;
        private Vehicle? _vehicle;
        private bool _isLoading;
        private bool _hasResult;
        private bool _hasError;
        private string _errorMessage = string.Empty;
        private bool _isIdle = true;

        public SearchViewModel()
        {
            _api = new VehicleApiService();
            SearchCommand = new Command(async () => await SearchAsync(), () => !IsLoading && !string.IsNullOrWhiteSpace(PlateInput));
        }

        public ICommand SearchCommand { get; }

        public string PlateInput
        {
            get => _plateInput;
            set
            {
                SetProperty(ref _plateInput, value.ToUpper());
                ((Command)SearchCommand).ChangeCanExecute();
            }
        }

        public Vehicle? Vehicle
        {
            get => _vehicle;
            set => SetProperty(ref _vehicle, value);
        }

        public bool IsLoading
        {
            get => _isLoading;
            set
            {
                SetProperty(ref _isLoading, value);
                ((Command)SearchCommand).ChangeCanExecute();
            }
        }

        public bool HasResult
        {
            get => _hasResult;
            set => SetProperty(ref _hasResult, value);
        }

        public bool HasError
        {
            get => _hasError;
            set => SetProperty(ref _hasError, value);
        }

        public string ErrorMessage
        {
            get => _errorMessage;
            set => SetProperty(ref _errorMessage, value);
        }

        public bool IsIdle
        {
            get => _isIdle;
            set => SetProperty(ref _isIdle, value);
        }

        // Owner photo URLs
        public string Owner1PhotoUrl => _api.GetPhotoUrl(Vehicle?.Wlasciciel?.ZdjeciePath);
        public string Owner2PhotoUrl => _api.GetPhotoUrl(Vehicle?.DrugiWlasciciel?.ZdjeciePath);

        private async Task SearchAsync()
        {
            if (string.IsNullOrWhiteSpace(PlateInput)) return;

            IsLoading = true;
            HasResult = false;
            HasError = false;
            IsIdle = false;
            Vehicle = null;

            var result = await _api.SearchByPlateAsync(PlateInput);

            IsLoading = false;

            if (result.Sukces && result.Pojazd != null)
            {
                Vehicle = result.Pojazd;
                HasResult = true;
                OnPropertyChanged(nameof(Owner1PhotoUrl));
                OnPropertyChanged(nameof(Owner2PhotoUrl));
            }
            else
            {
                HasError = true;
                ErrorMessage = result.Wiadomosc ?? "Nie znaleziono pojazdu o podanym numerze rejestracyjnym.";
            }
        }

        public void Clear()
        {
            PlateInput = string.Empty;
            Vehicle = null;
            HasResult = false;
            HasError = false;
            IsIdle = true;
        }

        public event PropertyChangedEventHandler? PropertyChanged;

        protected void OnPropertyChanged([CallerMemberName] string? name = null)
            => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));

        protected bool SetProperty<T>(ref T field, T value, [CallerMemberName] string? name = null)
        {
            if (EqualityComparer<T>.Default.Equals(field, value)) return false;
            field = value;
            OnPropertyChanged(name);
            return true;
        }
    }
}
