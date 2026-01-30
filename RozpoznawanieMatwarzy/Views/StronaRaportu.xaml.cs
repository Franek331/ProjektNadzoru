using RozpoznawanieMatwarzy.Services;
using RozpoznawanieMatwarzy.ViewModels;
using System.Diagnostics;

namespace RozpoznawanieMatwarzy.Views;

public partial class StronaRaportu : ContentPage
{
    private ModelRaportu _viewModel;

    public StronaRaportu()
    {
        Debug.WriteLine("🔴 StronaRaportu CONSTRUCTOR START");

        InitializeComponent();
        _viewModel = new ModelRaportu();
        BindingContext = _viewModel;

        // ✅ DEBUGOWANIE - sprawdź czy RaportHelper ma dane
        Debug.WriteLine($"[StronaRaportu] RaportHelper.OstatniaRozpoznana is null: {RaportHelper.OstatniaRozpoznana == null}");

        if (RaportHelper.OstatniaRozpoznana != null)
        {
            var osoba = RaportHelper.OstatniaRozpoznana;

            Debug.WriteLine($"[StronaRaportu] 📋 Dane z RaportHelper PRZED WczytajDaneOsoby:");
            Debug.WriteLine($"[StronaRaportu]    Typ: {osoba.GetType().Name}");
            Debug.WriteLine($"[StronaRaportu]    Pesel: '{osoba.Pesel}'");
            Debug.WriteLine($"[StronaRaportu]    Imie: '{osoba.Imie}'");
            Debug.WriteLine($"[StronaRaportu]    Nazwisko: '{osoba.Nazwisko}'");
            Debug.WriteLine($"[StronaRaportu]    DataUrodzenia: '{osoba.DataUrodzenia}'");
            Debug.WriteLine($"[StronaRaportu]    Plec: '{osoba.Plec}'");

            Debug.WriteLine($"[StronaRaportu] 📞 Wywołuję WczytajDaneOsoby...");

            _viewModel.WczytajDaneOsoby(
                RaportHelper.OstatniaRozpoznana,
                RaportHelper.WybraneZdjecie
            );

            Debug.WriteLine($"[StronaRaportu] 📋 Dane w ViewModel PO WczytajDaneOsoby:");
            Debug.WriteLine($"[StronaRaportu]    ViewModel.Pesel: '{_viewModel.Pesel}'");
            Debug.WriteLine($"[StronaRaportu]    ViewModel.PelneImie: '{_viewModel.PelneImie}'");
            Debug.WriteLine($"[StronaRaportu]    ViewModel.DataUrodzenia: '{_viewModel.DataUrodzenia}'");
            Debug.WriteLine($"[StronaRaportu]    ViewModel.Plec: '{_viewModel.Plec}'");
        }
        else
        {
            Debug.WriteLine("[StronaRaportu] ❌❌❌ RaportHelper.OstatniaRozpoznana jest NULL!");
            Debug.WriteLine("[StronaRaportu] Dane nie zostały wczytane!");
        }

        Debug.WriteLine("🟢 StronaRaportu CONSTRUCTOR END");
    }

    protected override void OnDisappearing()
    {
        base.OnDisappearing();
        Debug.WriteLine("[StronaRaportu] 🧹 OnDisappearing - czyszczę RaportHelper");
        RaportHelper.OstatniaRozpoznana = null;
        RaportHelper.WybraneZdjecie = null;
    }
}