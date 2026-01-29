using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading.Tasks;

namespace RozpoznawanieMatwarzy.Models
{
    public class UzytkownikInfo
    {
        [JsonPropertyName("Id")]
        public int Id { get; set; }

        [JsonPropertyName("Username")]
        public string Username { get; set; }

        [JsonPropertyName("Rola")]
        public string Rola { get; set; }
    }
}
