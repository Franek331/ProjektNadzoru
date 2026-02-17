using System.Text.Json.Serialization;

namespace CarSearch.Models
{
    public class VehicleSearchResponse
    {
        [JsonPropertyName("Sukces")]
        public bool Sukces { get; set; }

        [JsonPropertyName("Pojazd")]
        public Vehicle? Pojazd { get; set; }

        [JsonPropertyName("Wiadomosc")]
        public string? Wiadomosc { get; set; }
    }

    public class Vehicle
    {
        [JsonPropertyName("id")]
        public string? Id { get; set; }

        [JsonPropertyName("vin")]
        public string? Vin { get; set; }

        [JsonPropertyName("nr_rejestracji")]
        public string? NrRejestracji { get; set; }

        [JsonPropertyName("marka")]
        public string? Marka { get; set; }

        [JsonPropertyName("model")]
        public string? Model { get; set; }

        [JsonPropertyName("generacja")]
        public string? Generacja { get; set; }

        [JsonPropertyName("kolor")]
        public string? Kolor { get; set; }

        [JsonPropertyName("rok_produkcji")]
        public int RokProdukcji { get; set; }

        [JsonPropertyName("typ_nadwozia")]
        public string? TypNadwozia { get; set; }

        [JsonPropertyName("pojemnosc_silnika")]
        public int? PojemnoscSilnika { get; set; }

        [JsonPropertyName("moc_kw")]
        public int? MocKw { get; set; }

        [JsonPropertyName("paliwo")]
        public string? Paliwo { get; set; }

        [JsonPropertyName("przebieg")]
        public int Przebieg { get; set; }

        [JsonPropertyName("stan")]
        public string? Stan { get; set; }

        [JsonPropertyName("uwagi")]
        public string? Uwagi { get; set; }

        [JsonPropertyName("wlasciciel_pesel")]
        public string? WlascicielPesel { get; set; }

        [JsonPropertyName("drugi_wlasciciel_pesel")]
        public string? DrugiWlascicielPesel { get; set; }

        [JsonPropertyName("created_at")]
        public string? CreatedAt { get; set; }

        [JsonPropertyName("Wlasciciel")]
        public Owner? Wlasciciel { get; set; }

        [JsonPropertyName("DrugiWlasciciel")]
        public Owner? DrugiWlasciciel { get; set; }

        // Computed
        public bool IsSkradziony => Stan?.ToLower() == "skradziony";
        public string FullName => $"{Marka} {Model}{(string.IsNullOrEmpty(Generacja) ? "" : $" ({Generacja})")}";
        public string MocDisplay => (MocKw.HasValue && MocKw.Value > 0) ? $"{MocKw.Value} kW ({(int)(MocKw.Value * 1.36)} KM)" : "—";
        public string PrzebiegDisplay => Przebieg > 0 ? $"{Przebieg:N0} km" : "—";
        public string PojemnoscDisplay => (PojemnoscSilnika.HasValue && PojemnoscSilnika.Value > 0) ? $"{PojemnoscSilnika.Value} ccm" : "—";
    }

    public class Owner
    {
        [JsonPropertyName("Pesel")]
        public string? Pesel { get; set; }

        [JsonPropertyName("Imie")]
        public string? Imie { get; set; }

        [JsonPropertyName("Nazwisko")]
        public string? Nazwisko { get; set; }

        [JsonPropertyName("DataUrodzenia")]
        public string? DataUrodzenia { get; set; }

        [JsonPropertyName("Plec")]
        public string? Plec { get; set; }

        [JsonPropertyName("ZdjęciePath")]
        public string? ZdjeciePath { get; set; }

        public string FullName => (string.IsNullOrEmpty(Imie) && string.IsNullOrEmpty(Nazwisko))
            ? "Brak danych" : $"{Imie} {Nazwisko}";

        public bool HasData => !string.IsNullOrEmpty(Imie);
    }
}