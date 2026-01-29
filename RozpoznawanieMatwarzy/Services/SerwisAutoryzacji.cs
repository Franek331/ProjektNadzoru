using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http.Json;
using System.Text;
using System.Threading.Tasks;
using RozpoznawanieMatwarzy.Models;

namespace RozpoznawanieMatwarzy.Services
{
    public class SerwisAutoryzacji
    {
        private readonly HttpClient _httpClient;
        private const string TOKEN_KEY = "1745618756195nfcsjnjbnv";
        private const string USERNAME_KEY = "username";

        public SerwisAutoryzacji()
        {
            // ✅ DEBUGUJ URL
            var baseUrl = Stale.URL_BAZY;
            System.Diagnostics.Debug.WriteLine($"🔍 URL_BAZY: {baseUrl}");

            _httpClient = new HttpClient
            {
                BaseAddress = new Uri(baseUrl),
                Timeout = TimeSpan.FromSeconds(30)
            };

            // ✅ DODAJ DOMYŚLNE HEADERY
            _httpClient.DefaultRequestHeaders.Add("User-Agent", "RozpoznawanieMatwarzy/1.0");
        }

        public async Task<LoginResponse> ZalogujAsync(string username, string password)
        {
            try
            {
                System.Diagnostics.Debug.WriteLine($"📝 ZalogujAsync - username: {username}");

                // ❌ PROBLEM: Jeśli BaseAddress ma "http://localhost:5000/"
                // i wysyłasz "/api/login", może być problem
                // ROZWIĄZANIE: Upewnij się że ścieżka jest poprawna

                var loginData = new
                {
                    username = username,
                    password = password
                };

                System.Diagnostics.Debug.WriteLine($"📤 Wysyłam POST do: {_httpClient.BaseAddress}api/login");
                System.Diagnostics.Debug.WriteLine($"📤 Dane: {System.Text.Json.JsonSerializer.Serialize(loginData)}");

                // ✅ ZMIANA: Nie zaczynaj ze "/" bo BaseAddress też może mieć "/"
                var response = await _httpClient.PostAsJsonAsync("api/login", loginData);

                System.Diagnostics.Debug.WriteLine($"📥 Status code: {response.StatusCode}");

                if (response.IsSuccessStatusCode)
                {
                    System.Diagnostics.Debug.WriteLine("✅ Odpowiedź pomyślna (200)");

                    try
                    {
                        var result = await response.Content.ReadFromJsonAsync<LoginResponse>();

                        System.Diagnostics.Debug.WriteLine($"✅ Rozpakowana odpowiedź:");
                        System.Diagnostics.Debug.WriteLine($"   Sukces: {result?.Sukces}");
                        System.Diagnostics.Debug.WriteLine($"   Wiadomosc: {result?.Wiadomosc}");
                        System.Diagnostics.Debug.WriteLine($"   Token: {result?.Token?.Substring(0, Math.Min(50, result?.Token?.Length ?? 0)) ?? "null"}...");

                        if (result != null && result.Sukces)
                        {
                            // Zapisz token i nazwę użytkownika
                            System.Diagnostics.Debug.WriteLine("💾 Zapisuję token do SecureStorage...");

                            await SecureStorage.SetAsync(TOKEN_KEY, result.Token);
                            await SecureStorage.SetAsync(USERNAME_KEY, username);

                            System.Diagnostics.Debug.WriteLine("✅ Token zapisany");
                        }

                        return result ?? new LoginResponse
                        {
                            Sukces = false,
                            Wiadomosc = "Pusta odpowiedź z serwera"
                        };
                    }
                    catch (Exception parseEx)
                    {
                        System.Diagnostics.Debug.WriteLine($"❌ Błąd parsowania JSON: {parseEx.Message}");

                        var rawContent = await response.Content.ReadAsStringAsync();
                        System.Diagnostics.Debug.WriteLine($"📄 Raw content: {rawContent}");

                        return new LoginResponse
                        {
                            Sukces = false,
                            Wiadomosc = $"Błąd parsowania odpowiedzi: {parseEx.Message}"
                        };
                    }
                }
                else
                {
                    System.Diagnostics.Debug.WriteLine($"❌ Błąd HTTP {response.StatusCode}");

                    var errorContent = await response.Content.ReadAsStringAsync();
                    System.Diagnostics.Debug.WriteLine($"📄 Error content: {errorContent}");

                    return new LoginResponse
                    {
                        Sukces = false,
                        Wiadomosc = $"Błąd: {response.StatusCode} - {errorContent}"
                    };
                }
            }
            catch (HttpRequestException ex)
            {
                System.Diagnostics.Debug.WriteLine($"❌ HttpRequestException: {ex.Message}");
                System.Diagnostics.Debug.WriteLine($"   InnerException: {ex.InnerException?.Message}");

                return new LoginResponse
                {
                    Sukces = false,
                    Wiadomosc = $"Błąd połączenia: {ex.Message}"
                };
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"❌ Wyjątek ogólny: {ex.GetType().Name} - {ex.Message}");
                System.Diagnostics.Debug.WriteLine($"   Stack: {ex.StackTrace}");

                return new LoginResponse
                {
                    Sukces = false,
                    Wiadomosc = $"Błąd: {ex.Message}"
                };
            }
        }

        public async Task<string> PobierzTokenAsync()
        {
            try
            {
                var token = await SecureStorage.GetAsync(TOKEN_KEY);
                System.Diagnostics.Debug.WriteLine($"🔑 PobierzTokenAsync: {(string.IsNullOrEmpty(token) ? "BRAK" : "OK")}");
                return token;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"❌ Błąd pobierania tokenu: {ex.Message}");
                return null;
            }
        }

        public async Task<string> PobierzUsernameAsync()
        {
            try
            {
                return await SecureStorage.GetAsync(USERNAME_KEY);
            }
            catch
            {
                return null;
            }
        }

        public async Task<bool> CzyZalogowanyAsync()
        {
            var token = await PobierzTokenAsync();
            bool zalogowany = !string.IsNullOrEmpty(token);
            System.Diagnostics.Debug.WriteLine($"👤 CzyZalogowanyAsync: {zalogowany}");
            return zalogowany;
        }

        public async Task WylogujAsync()
        {
            try
            {
                System.Diagnostics.Debug.WriteLine("🚪 WylogujAsync...");
                SecureStorage.Remove(TOKEN_KEY);
                SecureStorage.Remove(USERNAME_KEY);
                System.Diagnostics.Debug.WriteLine("✅ Wylogowano");
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"❌ Błąd wylogowania: {ex.Message}");
            }
        }

        public async Task<bool> WeryfikujTokenAsync()
        {
            try
            {
                System.Diagnostics.Debug.WriteLine("🔐 WeryfikujTokenAsync...");

                var token = await PobierzTokenAsync();
                if (string.IsNullOrEmpty(token))
                {
                    System.Diagnostics.Debug.WriteLine("❌ Brak tokenu");
                    return false;
                }

                _httpClient.DefaultRequestHeaders.Clear();
                _httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {token}");
                _httpClient.DefaultRequestHeaders.Add("User-Agent", "RozpoznawanieMatwarzy/1.0");

                System.Diagnostics.Debug.WriteLine("📤 Wysyłam GET /api/verify-token");

                var response = await _httpClient.GetAsync("api/verify-token");

                System.Diagnostics.Debug.WriteLine($"📥 Status: {response.StatusCode}");

                bool isValid = response.IsSuccessStatusCode;
                System.Diagnostics.Debug.WriteLine($"✅ Token ważny: {isValid}");

                return isValid;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"❌ Błąd weryfikacji: {ex.Message}");
                return false;
            }
        }
    }
}