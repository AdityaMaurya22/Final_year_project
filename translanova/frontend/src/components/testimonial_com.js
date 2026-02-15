import React from 'react';
import './testimonial_com.css';
import testimonial_logo from '../images/testimonial_logo.png';
import CarouselComponent from '../components/carousel.js';

function TestimonialCom() {
    return (
        <section className="home_sect4">
            <div className="container">
                <div className="row">
                    <div className="col-lg-12">
                        <div className="sect4_div1">
                            <div className="sect4_div2">
                                <div className="row">
                                    <div className="col-lg-5">
                                        <div className="testimonial_content">
                                            <h2>Connect With Our Users</h2>
                                            <p>The robot clicked disapprovingly, gurgled briefly inside its cubical interior and extruded a pony glass of brownish liquid.</p>
                                        </div>
                                    </div>
                                    <div className="col-lg-7">
                                        <div className="row">
                                            <div className="col-lg-12">
                                                <CarouselComponent />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="sect4_logo">
                                        <img src={testimonial_logo} alt="inverted_semicolen"></img>
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

export default TestimonialCom;