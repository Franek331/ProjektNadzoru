using System.Net.Http.Json;
using CarSearch.Models;

namespace CarSearch.Services
{
    public class VehicleApiService
    {
        private const string BASE_URL = "http://192.168.88.253:5010/api";
        private const string FACES_URL = "http://192.168.88.253:5000";

        private readonly HttpClient _http;

        public VehicleApiService()
        {
            _http = new HttpClient
            {
                Timeout = TimeSpan.FromSeconds(10)
            };
        }

        public async Task<VehicleSearchResponse> SearchByPlateAsync(string plate)
        {
            try
            {
                var cleanPlate = plate.Trim().ToUpper().Replace(" ", "");
                var url = $"{BASE_URL}/vehicles/by-plate/{Uri.EscapeDataString(cleanPlate)}";
                var response = await _http.GetFromJsonAsync<VehicleSearchResponse>(url);
                return response ?? new VehicleSearchResponse { Sukces = false, Wiadomosc = "Brak odpowiedzi" };
            }
            catch (HttpRequestException)
            {
                return new VehicleSearchResponse { Sukces = false, Wiadomosc = "Błąd połączenia z serwerem. Sprawdź czy jesteś w tej samej sieci." };
            }
            catch (TaskCanceledException)
            {
                return new VehicleSearchResponse { Sukces = false, Wiadomosc = "Timeout — serwer nie odpowiada." };
            }
            catch (Exception ex)
            {
                return new VehicleSearchResponse { Sukces = false, Wiadomosc = $"Błąd: {ex.Message}" };
            }
        }

        public string GetPhotoUrl(string? path)
        {
            if (string.IsNullOrEmpty(path)) return string.Empty;
            return $"{FACES_URL}{path}";
        }
    }
}
