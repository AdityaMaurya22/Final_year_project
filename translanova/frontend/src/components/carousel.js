import React from "react";
import Slider from "react-slick";
import "./carousel.css";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import testimonial1 from '../images/testimonial_new1.jpg';
import testimonial2 from '../images/testimonial2.jpg';
import testimonial3 from '../images/testimonial_new2.jpg';
import testimonial4 from '../images/testimonial_new3.jpg';

const CarouselComponent = () => {
  const images = [
    {
      src: testimonial1,
      title: "Milan",
      description: "Description for slide 1",
    },
    {
      src: testimonial2,
      title: "Aditya",
      description: "Description for slide 2",
    },
    {
      src: testimonial3,
      title: "Siddharth",
      description: "Description for slide 3",
    },
    {
      src: testimonial4,
      title: "Prachi",
      description: "Description for slide 4",
    },
  ];

  const settings = {
    dots: true,
    infinite: true,
    speed: 800,
    slidesToShow: 2,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 3000,
    arrows: true,
  };

  return (
    <div className="carousel-container">
      <Slider {...settings}>
        {images.map((item, index) => (
          <div key={index} className="carousel-card">
            <div className="sect4_card">
              <img src={item.src} alt={`Slide ${index + 1}`} className="card-img" />
              <div className="card-content">
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
            </div>
          </div>
        ))}
      </Slider>
    </div>
  );
};

export default CarouselComponent;
