using System;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Diagnostics;
using System.Reflection;
using System.Windows.Input;
using RozpoznawanieMatwarzy.Models;
using RozpoznawanieMatwarzy.Services;

namespace RozpoznawanieMatwarzy.ViewModels
{
    public class ModelRaportu : INotifyPropertyChanged
    {
        private readonly SerwisRaportu _serwisRaportu;

        // ✅ Właściwości bindowane
        private string _pelneImie;
        public string PelneImie
        {
            get => _pelneImie;
            set { _pelneImie = value; OnPropertyChanged(nameof(PelneImie)); }
        }

        private string _pesel;
        public string Pesel
        {
            get => _pesel;
            set { _pesel = value; OnPropertyChanged(nameof(Pesel)); }
        }

        private string _dataUrodzenia;
        public string DataUrodzenia
        {
            get => _dataUrodzenia;
            set { _dataUrodzenia = value; OnPropertyChanged(nameof(DataUrodzenia)); }
        }

        private string _plec;
        public string Plec
        {
            get => _plec;
            set { _plec = value; OnPropertyChanged(nameof(Plec)); }
        }

        private double _pewnosc;
        public double Pewnosc
        {
            get => _pewnosc;
            set { _pewnosc = value; OnPropertyChanged(nameof(Pewnosc)); }
        }

        private string _notatka;
        public string Notatka
        {
            get => _notatka;
            set { _notatka = value; OnPropertyChanged(nameof(Notatka)); }
        }

        private string _przeprowadzoneDialania;
        public string PrzeprowadzoneDialania
        {
            get => _przeprowadzoneDialania;
            set { _przeprowadzoneDialania = value; OnPropertyChanged(nameof(PrzeprowadzoneDialania)); }
        }

        private bool _czyMandat;
        public bool CzyMandat
        {
            get => _czyMandat;
            set { _czyMandat = value; OnPropertyChanged(nameof(CzyMandat)); }
        }

        private string _kwotaMandatu;
        public string KwotaMandatu
        {
            get => _kwotaMandatu;
            set { _kwotaMandatu = value; OnPropertyChanged(nameof(KwotaMandatu)); }
        }

        private string _numerMandata;
        public string NumerMandata
        {
            get => _numerMandata;
            set { _numerMandata = value; OnPropertyChanged(nameof(NumerMandata)); }
        }

        private string _typMandata;
        public string TypMandata
        {
            get => _typMandata;
            set { _typMandata = value; OnPropertyChanged(nameof(TypMandata)); }
        }

        private string _statusMandata;
        public string StatusMandata
        {
            get => _statusMandata;
            set { _statusMandata = value; OnPropertyChanged(nameof(StatusMandata)); }
        }

        private string _komunikat;
        public string Komunikat
        {
            get => _komunikat;
            set { _komunikat = value; OnPropertyChanged(nameof(Komunikat)); }
        }

        private Color _kolorStatusu;
        public Color KolorStatusu
        {
            get => _kolorStatusu;
            set { _kolorStatusu = value; OnPropertyChanged(nameof(KolorStatusu)); }
        }

        private bool _czyWidocznyStatus;
        public bool CzyWidocznyStatus
        {
            get => _czyWidocznyStatus;
            set { _czyWidocznyStatus = value; OnPropertyChanged(nameof(CzyWidocznyStatus)); }
        }

        private bool _jestZajety;
        public bool JestZajety
        {
            get => _jestZajety;
            set { _jestZajety = value; OnPropertyChanged(nameof(JestZajety)); }
        }

        private ObservableCollection<string> _listaTypowMandatow;
        public ObservableCollection<string> ListaTypowMandatow
        {
            get => _listaTypowMandatow;
            set { _listaTypowMandatow = value; OnPropertyChanged(nameof(ListaTypowMandatow)); }
        }

        private ObservableCollection<string> _listaStatusowMandatu;
        public ObservableCollection<string> ListaStatusowMandatu
        {
            get => _listaStatusowMandatu;
            set { _listaStatusowMandatu = value; OnPropertyChanged(nameof(ListaStatusowMandatu)); }
        }

        // Commands
        public ICommand ZapiszRaportCommand { get; }
        public ICommand WyslijRaportCommand { get; }
        public ICommand WyczyscCommand { get; }

        // INotifyPropertyChanged
        public event PropertyChangedEventHandler PropertyChanged;

        public ModelRaportu()
        {
            _serwisRaportu = new SerwisRaportu();

            // Inicjalizuj listy
            ListaTypowMandatow = new ObservableCollection<string>
            {
                "Parkowanie w niedozwolonym miejscu",
                "Brak biletu parkingowego",
                "Przekroczenie prędkości",
                "Przejechanie na czerwonym świetle",
                "Brak pasów bezpieczeństwa",
                "Jazda pod wpływem alkoholu",
                "Inne"
            };

            ListaStatusowMandatu = new ObservableCollection<string>
            {
                "Do wysłania",
                "Wysłany",
                "Opłacony",
                "Niepłacony",
                "Zakwestionowany"
            };

            // Inicjalizuj Commands
            ZapiszRaportCommand = new Command(async () => await ZapiszRaport());
            WyslijRaportCommand = new Command(async () => await WyslijRaport());
            WyczyscCommand = new Command(Wyczysc);

            // Domyślne wartości
            CzyMandat = false;
            StatusMandata = "Do wysłania";
            KolorStatusu = Colors.Black;
            CzyWidocznyStatus = false;
            JestZajety = false;
        }

        /// <summary>
        /// Wczytaj dane rozpoznanej osoby
        /// </summary>
        public void WczytajDaneOsoby(object osoba, ImageSource zdjecie)
        {
            try
            {
                DebugLog("🔄 Wczytywanie danych osoby...");
                DebugLog($"   Typ obiektu: {osoba?.GetType().Name}");

                if (osoba == null)
                {
                    DebugLog("⚠️ Osoba jest null!");
                    Komunikat = "❌ Błąd: Brak danych osoby";
                    KolorStatusu = Colors.Red;
                    CzyWidocznyStatus = true;
                    return;
                }

                // Pobranie właściwości przez reflection
                var type = osoba.GetType();
                var properties = type.GetProperties();
                DebugLog($"   Właściwości dostępne: {string.Join(", ", properties.Select(p => p.Name))}");

                // ✅ PROSTSZE - bez BindingFlags, bezpośrednio po nazwach
                object peselObj = null;
                object imieObj = null;
                object nazwiskoObj = null;
                object dataObj = null;
                object plecObj = null;
                object pewnoscObj = null;

                foreach (var prop in properties)
                {
                    DebugLog($"   Checking property: {prop.Name}");

                    switch (prop.Name)
                    {
                        case "Pesel":
                            peselObj = prop.GetValue(osoba);
                            DebugLog($"     Pesel found: '{peselObj}'");
                            break;
                        case "Imie":
                            imieObj = prop.GetValue(osoba);
                            DebugLog($"     Imie found: '{imieObj}'");
                            break;
                        case "Nazwisko":
                            nazwiskoObj = prop.GetValue(osoba);
                            DebugLog($"     Nazwisko found: '{nazwiskoObj}'");
                            break;
                        case "DataUrodzenia":
                            dataObj = prop.GetValue(osoba);
                            DebugLog($"     DataUrodzenia found: '{dataObj}'");
                            break;
                        case "Plec":
                            plecObj = prop.GetValue(osoba);
                            DebugLog($"     Plec found: '{plecObj}'");
                            break;
                        case "Pewnosc":
                            pewnoscObj = prop.GetValue(osoba);
                            DebugLog($"     Pewnosc found: '{pewnoscObj}'");
                            break;
                    }
                }

                Pesel = peselObj?.ToString() ?? "";
                string imie = imieObj?.ToString() ?? "";
                string nazwisko = nazwiskoObj?.ToString() ?? "";
                PelneImie = $"{imie} {nazwisko}".Trim();
                DataUrodzenia = dataObj?.ToString() ?? "";
                Plec = plecObj?.ToString() ?? "";

                if (pewnoscObj != null)
                {
                    if (double.TryParse(pewnoscObj.ToString(), out double pewnosc))
                    {
                        Pewnosc = pewnosc;
                    }
                }

                DebugLog($"✅ Dane wczytane:");
                DebugLog($"   PESEL: '{Pesel}' (pustePESEL: {string.IsNullOrWhiteSpace(Pesel)})");
                DebugLog($"   Imie: '{imie}'");
                DebugLog($"   Nazwisko: '{nazwisko}'");
                DebugLog($"   Pełne Imię: '{PelneImie}'");
                DebugLog($"   Data urodzenia: '{DataUrodzenia}'");
                DebugLog($"   Płeć: '{Plec}'");
                DebugLog($"   Pewność: {Pewnosc:P}");

                // ✅ WALIDACJA
                if (string.IsNullOrWhiteSpace(Pesel))
                {
                    DebugLog("⚠️⚠️⚠️ PESEL jest pusty! To jest główny problem!");
                    Komunikat = "❌ KRYTYCZNY: PESEL nie został wczytany!";
                    KolorStatusu = Colors.Red;
                    CzyWidocznyStatus = true;
                    return;
                }

                CzyWidocznyStatus = false;
                Komunikat = "";
            }
            catch (Exception ex)
            {
                DebugLog($"💥 Błąd wczytywania danych: {ex.Message}\n{ex.StackTrace}");
                Komunikat = $"❌ Błąd: {ex.Message}";
                KolorStatusu = Colors.Red;
                CzyWidocznyStatus = true;
            }
        }

        /// <summary>
        /// Wygeneruj obiekt Raport
        /// </summary>
        private Raport GenerujRaport()
        {
            DebugLog($"🔧 GenerujRaport() START");
            DebugLog($"   this.Pesel: '{this.Pesel}'");
            DebugLog($"   this.PelneImie: '{this.PelneImie}'");

            var czasiImieNazwisko = PelneImie?.Split(' ');
            string imie = czasiImieNazwisko?.Length > 0 ? czasiImieNazwisko[0] : "BRAK";
            string nazwisko = czasiImieNazwisko?.Length > 1
                ? string.Join(" ", czasiImieNazwisko.Skip(1))
                : "BRAK";

            // ✅ Konwersja DataUrodzenia z string na DateTime
            DateTime dataUrodzenia = DateTime.MinValue;
            if (!string.IsNullOrWhiteSpace(this.DataUrodzenia))
            {
                // Spróbuj różne formaty
                if (DateTime.TryParse(this.DataUrodzenia, out var parsedDate))
                {
                    dataUrodzenia = parsedDate;
                }
                else
                {
                    DebugLog($"⚠️ Nie można sparsować datę: {this.DataUrodzenia}");
                }
            }

            var raport = new Raport
            {
                Id = Guid.NewGuid().ToString(),
                Pesel = this.Pesel,
                Imie = imie,
                Nazwisko = nazwisko,
                DataUrodzenia = dataUrodzenia,  // ✅ Teraz DateTime
                Plec = this.Plec,
                Pewnosc = this.Pewnosc,
                Notatka = this.Notatka ?? "",
                PrzeprowadzoneDialania = this.PrzeprowadzoneDialania ?? "",
                CzyMandat = this.CzyMandat,
                KwotaMandatu = this.CzyMandat && !string.IsNullOrEmpty(this.KwotaMandatu)
                    ? this.KwotaMandatu
                    : null,
                NumerMandata = this.CzyMandat && !string.IsNullOrEmpty(this.NumerMandata)
                    ? this.NumerMandata
                    : null,
                TypMandata = this.TypMandata ?? "",
                StatusMandata = this.StatusMandata ?? "Do wysłania"
            };

            DebugLog($"🔧 GenerujRaport() - RAPORT CREATED:");
            DebugLog($"   raport.Pesel: '{raport.Pesel}'");
            DebugLog($"   raport.Imie: '{raport.Imie}'");
            DebugLog($"   raport.Nazwisko: '{raport.Nazwisko}'");
            DebugLog($"🔧 GenerujRaport() END");

            return raport;
        }

        /// <summary>
        /// Zapisz raport lokalnie
        /// </summary>
        private async Task ZapiszRaport()
        {
            if (JestZajety) return;

            try
            {
                JestZajety = true;
                CzyWidocznyStatus = false;

                // ✅ Walidacja
                if (string.IsNullOrWhiteSpace(Pesel))
                {
                    Komunikat = "❌ Błąd: Brakuje PESELu - data nie została załadowana prawidłowo";
                    KolorStatusu = Colors.Red;
                    CzyWidocznyStatus = true;
                    DebugLog("⚠️ PESEL jest pusty!");
                    return;
                }

                var raport = GenerujRaport();
                DebugLog($"💾 Zapisuję raport: PESEL={raport.Pesel}, Imie={raport.Imie}");

                var wynik = await _serwisRaportu.ZapiszRaportAsync(raport);

                if (wynik.Sukces)
                {
                    Komunikat = "✅ Raport zapisany pomyślnie!";
                    KolorStatusu = Colors.Green;
                }
                else
                {
                    Komunikat = $"❌ Błąd: {wynik.Wiadomosc}";
                    KolorStatusu = Colors.Red;
                }

                CzyWidocznyStatus = true;
            }
            catch (Exception ex)
            {
                Komunikat = $"❌ Wyjątek: {ex.Message}";
                KolorStatusu = Colors.Red;
                CzyWidocznyStatus = true;
                DebugLog($"💥 {ex}");
            }
            finally
            {
                JestZajety = false;
            }
        }

        /// <summary>
        /// Wyślij raport do systemu
        /// </summary>
        private async Task WyslijRaport()
        {
            if (JestZajety) return;

            try
            {
                JestZajety = true;
                CzyWidocznyStatus = false;

                // ✅ Walidacja
                if (string.IsNullOrWhiteSpace(Pesel))
                {
                    Komunikat = "❌ Błąd: Brakuje PESELu\n\nOsoby nie została załadowana prawidłowo.\nWróć do rozpoznawania twarzy.";
                    KolorStatusu = Colors.Red;
                    CzyWidocznyStatus = true;
                    DebugLog("⚠️ Wysyłanie zablokowane - brak PESELu");
                    return;
                }

                var raport = GenerujRaport();
                DebugLog($"📤 Wysyłam raport: PESEL={raport.Pesel}, Imie={raport.Imie}, CzyMandat={raport.CzyMandat}");

                var wynik = await _serwisRaportu.WyslijRaportAsync(raport);

                if (wynik.Sukces)
                {
                    Komunikat = "✅ Raport wysłany do systemu!\n\nMandat został zarejestrowany.";
                    KolorStatusu = Colors.Green;

                    // Wyczyść formularz po 1.5 sekundy
                    MainThread.BeginInvokeOnMainThread(async () =>
                    {
                        await Task.Delay(1500);
                        Wyczysc();
                    });
                }
                else
                {
                    Komunikat = wynik.Wiadomosc;
                    KolorStatusu = Colors.Red;
                    DebugLog($"❌ Wysyłanie nie powiodło się: {wynik.Wiadomosc}");
                }

                CzyWidocznyStatus = true;
            }
            catch (Exception ex)
            {
                Komunikat = $"❌ Błąd: {ex.Message}";
                KolorStatusu = Colors.Red;
                CzyWidocznyStatus = true;
                DebugLog($"💥 Wyjątek: {ex}");
            }
            finally
            {
                JestZajety = false;
            }
        }

        /// <summary>
        /// Wyczyść formularz
        /// </summary>
        private void Wyczysc()
        {
            DebugLog("🧹 Czyszczę formularz");

            PelneImie = "";
            Pesel = "";
            DataUrodzenia = "";
            Plec = "";
            Pewnosc = 0;
            Notatka = "";
            PrzeprowadzoneDialania = "";
            CzyMandat = false;
            KwotaMandatu = "";
            NumerMandata = "";
            TypMandata = ListaTypowMandatow.FirstOrDefault() ?? "";
            StatusMandata = "Do wysłania";

            Komunikat = "";
            CzyWidocznyStatus = false;
        }

        /// <summary>
        /// OnPropertyChanged
        /// </summary>
        protected void OnPropertyChanged(string propertyName)
        {
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
        }

        /// <summary>
        /// Debugowanie
        /// </summary>
        private void DebugLog(string message)
        {
            Debug.WriteLine($"[ModelRaportu] {message}");
        }
    }
}